import { server as serverConfig } from "./config/index.js";
import { createApp } from "./app.js";
import { prisma } from "@smartbusiness/database";
import { logger } from "./shared/services/logger.js";
import { drainBackgroundWork } from "./shared/services/background.js";

async function startServer() {
  try {
    logger.info("Connecting to database...");
    await prisma.$queryRawUnsafe("SELECT 1");
    logger.info("Database connected");

    const app = createApp();

    const httpServer = app.listen(serverConfig.port, () => {
      logger.info(
        { port: serverConfig.port, env: serverConfig.nodeEnv },
        "Platform API started",
      );
    });

    // Order matters: stop taking requests, let the ones in flight finish, let work
    // that outlives its request finish (e.g. reset emails), and only then close the
    // database. A hard limit stops a stuck task from blocking a deploy forever.
    let shuttingDown = false;
    const gracefulShutdown = async (signal: string) => {
      if (shuttingDown) return;
      shuttingDown = true;
      logger.info({ signal }, "Graceful shutdown initiated");

      const forceExit = setTimeout(() => {
        logger.error("Shutdown took longer than 15 s; exiting anyway");
        process.exit(1);
      }, 15_000);
      forceExit.unref();

      await new Promise<void>((resolve) => {
        httpServer.close(() => resolve());
        httpServer.closeIdleConnections();
      });
      logger.info("HTTP server closed");

      const unfinished = await drainBackgroundWork(10_000);
      if (unfinished > 0) logger.error({ unfinished }, "Background work still running at shutdown");

      try {
        await prisma.$disconnect();
        logger.info("Database disconnected");
      } catch (err) {
        logger.error(err, "Error disconnecting database");
      }

      logger.info("Shutdown complete");
      process.exit(signal === "SIGTERM" || signal === "SIGINT" ? 0 : 1);
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
    logger.fatal(err, "Platform API failed to start");
    await prisma.$disconnect();
    process.exit(1);
  }
}

startServer();
