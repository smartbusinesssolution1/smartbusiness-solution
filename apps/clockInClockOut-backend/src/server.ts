import { createApp } from "./app.js"
import { env } from "./config/index.js"
import { prisma } from "@smartbusiness/database"
import { logger } from "./shared/services/logger.js"
import { closeRedisConnection } from "./shared/services/redis.service.js"
import { initAutoClockOutScheduler, stopAutoClockOutScheduler } from "./modules/attendance/auto-clock-out.scheduler.js"

// Reload trigger: S3 storage active - Mumbai ap-south-1

async function startServer() {
    try {
        logger.info("Connecting to Database...")
        await prisma.$queryRaw`SELECT 1`
        logger.info("Database connected")

        const app = createApp()

        // Start Server
        const server = app.listen(env.server.port, () => {
            logger.info({ port: env.server.port, environment: env.server.nodeEnv }, "Server started" );

            // Initialize Auto-Clock-Out dual cron jobs (Midnight Day-Shift & Midday Night-Shift)
            initAutoClockOutScheduler();

            // Pre-warm caches in background so admin users experience instant 1ms response on first load
            setTimeout(async () => {
                try {
                    const { AdminAttendanceRepository } = await import("./modules/admin/attendance/admin-attendance.repository.js");
                    const { AdminAttendanceService } = await import("./modules/admin/attendance/admin-attendance.service.js");
                    const { AdminEmployeeRepository } = await import("./modules/admin/employee/admin-employee.repository.js");
                    const { AdminEmployeeService } = await import("./modules/admin/employee/admin-employee.service.js");
                    const repo = new AdminAttendanceRepository();
                    const service = new AdminAttendanceService(repo);
                    const empRepo = new AdminEmployeeRepository();
                    const empService = new AdminEmployeeService(empRepo);

                    const activeTenants = await prisma.tenant.findMany({
                        where: { status: "ACTIVE" },
                        select: { id: true },
                        take: 5,
                    });
                    for (const t of activeTenants) {
                        await repo.getCachedActiveEmployees(t.id);
                        await service.getSummary(t.id);
                        await service.getAttendanceReport(t.id, { page: 1, limit: 10, status: "all" });
                        await empService.listEmployees(t.id, { page: 1, limit: 10, status: "all", role: "all" });
                    }
                    logger.info("Admin cache pre-warming completed");
                } catch (err) {
                    logger.warn({ err }, "Cache pre-warm skipped");
                }
            }, 100);

            // Keep Neon serverless PostgreSQL connection pool awake
            const dbKeepAlive = setInterval(async () => {
                try {
                    await prisma.$queryRaw`SELECT 1`;
                } catch {
                    // non-fatal keepalive
                }
            }, 15000);
            dbKeepAlive.unref();
        })

        // Graceful Shutdown
        let isShuttingDown = false

        const gracefulShutdown = async (signal: string) => {

            // Prevent multiple shutdown executions
            if (isShuttingDown) {
                logger.warn({ signal }, "Shutdown already in progress")
                return
            }

            isShuttingDown = true

            logger.info({ signal }, "Graceful shutdown initiated...")

            const forceShutdownTimer = setTimeout(() => {
                logger.error("Graceful shutdown timed out. Forcing shutdown.")
                process.exit(1)
            }, 10000)

            try {
                    // Close HTTP server
                    await new Promise<void>((resolve, reject) => {
                        server.close((error) => {
                            if (error) {
                                reject(error)
                                return
                            }
                            logger.info("HTTP server closed")
                            resolve()
                        })
                    })
                
                    // Disconnect database
                    await prisma.$disconnect()
                    logger.info("Database disconnected")
                    await closeRedisConnection()
                    stopAutoClockOutScheduler()

                    clearTimeout(forceShutdownTimer)
                    logger.info("Shutdown complete")

                } catch (error) {
                    clearTimeout(forceShutdownTimer)
                    logger.error({ error }, "Error disconnecting database")
                    process.exit(1)
                }
            }

        process.on("SIGTERM", () => { void gracefulShutdown("SIGTERM") })
        process.on("SIGINT",  () => { void gracefulShutdown("SIGINT")  })

    } catch (error) {
        logger.error({ error }, "Failed to start server")
        await prisma.$disconnect().catch(() => {})
        process.exit(1)
    }
}

void startServer()