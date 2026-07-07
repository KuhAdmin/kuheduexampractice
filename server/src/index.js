import { createApp } from "./app.js";
import { env } from "./config/env.js";
import { initializeDatabase } from "./db/bootstrap.js";

const startServer = async () => {
  await initializeDatabase();

  const app = createApp();
  const server = app.listen(env.port, () => {
    console.log(`KUHEDU Practice API listening on http://localhost:${env.port}`);
  });

  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.error(
        `Port ${env.port} is already in use. Stop the existing process or change PORT in your .env before starting another server.`
      );
      process.exit(1);
    }

    console.error("Server failed to start", error);
    process.exit(1);
  });
};

startServer().catch((error) => {
  console.error("Failed to initialize server", error);
  process.exit(1);
});
