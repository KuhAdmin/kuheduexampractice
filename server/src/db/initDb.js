import { pool } from "./pool.js";
import { initializeDatabase } from "./bootstrap.js";

// Defaults to the safe, non-destructive path: missing tables/columns/views/
// seeds are created, existing data is left alone. Reset (drop and recreate
// the entire content schema -- assessment_unit, content_card, source_document/
// source_section, everything) requires BOTH --reset and --confirm=RESET,
// because this used to run reset unconditionally and silently wiped real
// imported content the one time someone ran `npm run db:init` expecting it
// to just apply a pending migration.
const args = process.argv.slice(2);
const reset = args.includes("--reset") && args.includes("--confirm=RESET");

if (args.includes("--reset") && !reset) {
  console.error('Refusing to reset: pass both --reset and --confirm=RESET to confirm you want to drop and recreate the pipeline schema.');
  process.exit(1);
}

const init = async () => {
  try {
    await initializeDatabase({ reset });
    console.log(
      reset
        ? "Database schema was reset and re-initialized (persisted pipeline data was dropped and recreated)."
        : "Database initialized successfully (missing tables, seeds, and views were created; existing data preserved)."
    );
  } finally {
    await pool.end();
  }
};

init().catch((error) => {
  console.error("Failed to initialize database", error);
  process.exit(1);
});
