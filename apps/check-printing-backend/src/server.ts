import { server as serverConfig } from "./config/index.js";
import { createApp } from "./app.js";
import { prisma } from "@smartbusiness/database";
import { logger } from "./shared/services/logger.js";
import { pdfRenderer } from "./modules/pdf/index.js";

// A bad MICR font must not stop the rest of the API, so this only reports;
// in strict mode the renderer itself refuses to print.
async function reportMicrFont() {
  try {
    const report = await pdfRenderer.checkFont();
    if (report.ok) {
      logger.info({ font: report.fontName, glyphs: report.checkedGlyphs }, "MICR font passed E-13B check");
    } else if (pdfRenderer.isStrictFont) {
      logger.error({ font: report.fontName, problems: report.problems }, "MICR font failed E-13B check: check printing is DISABLED");
    } else {
      logger.warn({ font: report.fontName, problems: report.problems }, "MICR font failed E-13B check: printing anyway because E13B_FONT_STRICT=false (development only)");
    }
  } catch (err) {
    logger.error(err, "MICR font could not be loaded: check printing will fail");
  }
}

async function startServer() {
  try {
    logger.info("Connecting to database...");
    await prisma.$queryRawUnsafe("SELECT 1");
    logger.info("Database connected");

    await reportMicrFont();

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
