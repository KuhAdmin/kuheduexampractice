// One-time (re-runnable) icon generator for PWA install icons, derived from
// the app's single existing logo asset (client/public/kuhedu-logo.png,
// 474x526, non-square). Run manually via `npm run gen:icons` whenever the
// source logo changes -- not part of the regular `vite build` pipeline,
// since the logo rarely changes and this shouldn't cost every build.
import sharp from "sharp";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = path.join(__dirname, "../public/kuhedu-logo.png");
const OUT_DIR = path.join(__dirname, "../public/icons");

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

// Resizes the source logo to fit within `logoSize`, then pads it onto a
// square canvas of `canvasSize`, centered, with the given background.
const buildIcon = async ({ canvasSize, logoSize, background, outFile }) => {
  const logo = await sharp(SOURCE)
    .resize(logoSize, logoSize, { fit: "contain", background: TRANSPARENT })
    .toBuffer();

  await sharp({
    create: {
      width: canvasSize,
      height: canvasSize,
      channels: 4,
      background,
    },
  })
    .composite([
      {
        input: logo,
        left: Math.round((canvasSize - logoSize) / 2),
        top: Math.round((canvasSize - logoSize) / 2),
      },
    ])
    .png()
    .toFile(path.join(OUT_DIR, outFile));

  console.log(`wrote ${outFile}`);
};

await buildIcon({ canvasSize: 192, logoSize: 168, background: TRANSPARENT, outFile: "icon-192.png" });
await buildIcon({ canvasSize: 512, logoSize: 448, background: TRANSPARENT, outFile: "icon-512.png" });
// Maskable: logo occupies ~60% of the canvas (Android's adaptive-icon safe
// zone) on a solid white background so OS mask shapes never clip it badly.
await buildIcon({ canvasSize: 512, logoSize: 307, background: WHITE, outFile: "maskable-icon-512.png" });
// iOS ignores alpha (renders it as black), so this must be fully opaque.
await buildIcon({ canvasSize: 180, logoSize: 158, background: WHITE, outFile: "apple-touch-icon.png" });

console.log("done.");
