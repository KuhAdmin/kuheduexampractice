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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const createApp = () => {
  const app = express();
  const isLocalDevOrigin = (origin = "") => {
    try {
      const parsedOrigin = new URL(origin);
      return ["localhost", "127.0.0.1", "::1"].includes(parsedOrigin.hostname);
    } catch {
      return false;
    }
  };
  const allowedOrigins = new Set(
    [
      env.clientUrl,
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:4173",
      "http://127.0.0.1:4173",
    ].filter(Boolean)
  );

  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin) || isLocalDevOrigin(origin)) {
          return callback(null, true);
        }

        return callback(new Error(`CORS blocked origin: ${origin}`));
      },
      credentials: true,
    })
  );
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
