import { pool } from "./pool.js";
import { initializeDatabase } from "./bootstrap.js";

const init = async () => {
  try {
    await initializeDatabase({ reset: true });
    console.log("Database initialized successfully.");
  } finally {
    await pool.end();
  }
};

init().catch((error) => {
  console.error("Failed to initialize database", error);
  process.exit(1);
});
