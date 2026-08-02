import path from "node:path";
import { fileURLToPath } from "node:url";
import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import session from "express-session";
import passport from "./config/passport.js";
import { env } from "./config/env.js";
import authRoutes from "./routes/authRoutes.js";
import catalogRoutes from "./routes/catalogRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import adminUserRoutes from "./routes/adminUserRoutes.js";
import adminExamTypeRoutes from "./routes/adminExamTypeRoutes.js";
import adminExamGoalRoutes from "./routes/adminExamGoalRoutes.js";
import adminLevelRoutes from "./routes/adminLevelRoutes.js";
import adminSubjectRoutes from "./routes/adminSubjectRoutes.js";
import adminBookRoutes from "./routes/adminBookRoutes.js";
import adminConceptImportRoutes from "./routes/adminConceptImportRoutes.js";
import adminDemoRoutes from "./routes/adminDemoRoutes.js";
import chapterExerciseAdminRoutes from "./routes/chapterExerciseAdminRoutes.js";
import mediaAdminRoutes from "./routes/mediaAdminRoutes.js";
import razorpayWebhookRoutes from "./routes/razorpayWebhookRoutes.js";
import adminOrdersRoutes from "./routes/adminOrdersRoutes.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const createApp = () => {
  const app = express();

  const parseOrigin = (origin) => {
    try {
      return new URL(origin);
    } catch {
      return null;
    }
  };

  // "www." is treated as optional/interchangeable on both sides -- a single
  // exact-string CLIENT_URL match caused a real production outage: prod was
  // actually served from https://www.exam4u.study, but CLIENT_URL didn't
  // have that exact "www.", so the site's OWN real visitors' same-origin
  // requests were rejected as a foreign origin.
  const stripWww = (hostname) => hostname.replace(/^www\./, "");

  const allowedOriginUrls = [
    env.clientUrl,
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:4173",
    "http://127.0.0.1:4173",
  ]
    .filter(Boolean)
    .map(parseOrigin)
    .filter(Boolean);

  const isAllowedOrigin = (origin) => {
    const parsedOrigin = parseOrigin(origin);
    if (!parsedOrigin) return false;
    if (["localhost", "127.0.0.1", "::1"].includes(parsedOrigin.hostname)) return true;

    return allowedOriginUrls.some(
      (allowed) =>
        allowed.protocol === parsedOrigin.protocol && stripWww(allowed.hostname) === stripWww(parsedOrigin.hostname)
    );
  };

  // Scoped to /api only -- a browser loading this same app's own static
  // assets/SPA shell is never a cross-origin concern, so CORS has no
  // business running (and potentially rejecting) those requests at all.
  // This is what was actually breaking: cors() used to run globally
  // (app.use(cors(...)) with no path), so the origin mismatch above was
  // crashing plain <script>/<link> asset loads, not just API calls.
  app.use(
    "/api",
    cors({
      origin(origin, callback) {
        if (!origin || isAllowedOrigin(origin)) {
          return callback(null, true);
        }

        // Never throw here -- that turns a disallowed origin into an
        // unhandled exception (Express's global error handler -> 500 for
        // every such request) instead of cors's normal, clean rejection.
        return callback(null, false);
      },
      credentials: true,
    })
  );
  // Must be mounted before express.json() below -- HMAC signature
  // verification needs the exact raw bytes Razorpay signed, and those are
  // gone once express.json() has parsed/re-encoded the body.
  app.use("/api/webhooks/razorpay", express.raw({ type: "application/json" }), razorpayWebhookRoutes);

  // 30mb covers a ~20MB memory-hook video upload as a base64 data URL
  // (~33% inflation) plus JSON overhead, with headroom.
  app.use(express.json({ limit: "30mb" }));
  app.use(cookieParser());
  app.use(
    session({
      secret: env.sessionSecret,
      resave: false,
      saveUninitialized: false,
      cookie: {
        maxAge: 1000 * 60 * 60,
      },
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, service: "kuhedu-practice-api" });
  });

  app.use("/api/auth", authRoutes);
  app.use("/api/catalog", catalogRoutes);
  app.use("/api/user", userRoutes);
  app.use("/api/admin/users", adminUserRoutes);
  app.use("/api/admin/exam-types", adminExamTypeRoutes);
  app.use("/api/admin/exam-goals", adminExamGoalRoutes);
  app.use("/api/admin/levels", adminLevelRoutes);
  app.use("/api/admin/subjects", adminSubjectRoutes);
  app.use("/api/admin/books", adminBookRoutes);
  app.use("/api/admin/concept-import", adminConceptImportRoutes);
  app.use("/api/admin/ai-demo", adminDemoRoutes);
  app.use("/api/admin/chapter-exercises", chapterExerciseAdminRoutes);
  app.use("/api/admin/media", mediaAdminRoutes);
  app.use("/api/admin/orders", adminOrdersRoutes);

  const clientDist = path.resolve(__dirname, "../../client/dist");
  app.use(
    express.static(clientDist, {
      // Vite hashes every filename under dist/assets/ from its own content
      // (e.g. index-CUDSvD7M.js) -- any content change produces a different
      // filename, so these are safe to cache forever. Without this,
      // express.static's default (Cache-Control: public, max-age=0) applied
      // to EVERY file including these, forcing a network round-trip for
      // every asset on every load -- worse repeat-visit performance, and
      // more exposure to any brief server hiccup during a deploy having
      // nothing cached to fall back on. index.html itself (outside
      // assets/) intentionally keeps the default max-age=0 -- it's the one
      // file that changes on every deploy and must always be re-fetched to
      // pick up the current build's hashed asset names.
      setHeaders: (res, filePath) => {
        if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
        }
      },
    })
  );

  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api")) {
      return next();
    }

    return res.sendFile(path.join(clientDist, "index.html"), (error) => {
      if (error) {
        res.status(404).json({
          message:
            "Client build not found. Run the Vite client in development or build it for production.",
        });
      }
    });
  });

  app.use((error, _req, res, _next) => {
    console.error(error);
    res.status(500).json({ message: "Internal server error." });
  });

  return app;
};
