import { server as serverConfig } from "./config/index.js";
import { createApp } from "./app.js";
import { prisma } from "@smartbusiness/database";
import { logger } from "./shared/services/logger.js";

async function startServer() {
  try {
    logger.info("Connecting to database...");
    await prisma.$queryRawUnsafe("SELECT 1");
    logger.info("Database connected");

    const app = createApp();

    const httpServer = app.listen(serverConfig.port, () => {
      logger.info({ port: serverConfig.port, env: serverConfig.nodeEnv }, "Server started");
    });

    // ─── Graceful Shutdown ──────────────────────────────────────

    const gracefulShutdown = async (signal: string) => {
      logger.info({ signal }, "Graceful shutdown initiated");

      httpServer.close(() => {
        logger.info("HTTP server closed");
      });

      try {
        await prisma.$disconnect();
        logger.info("Database disconnected");
      } catch (err) {
        logger.error(err, "Error disconnecting database");
      }

      setTimeout(() => {
        logger.info("Shutdown complete");
        process.exit(0);
      }, 10000);
    };

    process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
    process.on("SIGINT", () => gracefulShutdown("SIGINT"));

    process.on("unhandledRejection", (reason: unknown) => {
      logger.fatal(reason, "Unhandled rejection");
      gracefulShutdown("unhandledRejection");
    });

    process.on("uncaughtException", (error: Error) => {
      logger.fatal(error, "Uncaught exception");
      gracefulShutdown("uncaughtException");
    });
  } catch (err) {
    logger.fatal(err, "Server failed to start");
    await prisma.$disconnect();
    process.exit(1);
  }
}

startServer();
