import { createApp } from "./app.js"
import { env } from "./config/index.js"
import { prisma } from "@smartbusiness/database"
import { logger } from "./shared/services/logger.js"

async function startServer() {
    try {
        logger.info("Connecting to Database...")
        await prisma.$queryRaw`SELECT 1`
        logger.info("Database connected")

        const app = createApp()

        // Start Server
        const server = app.listen(env.server.port, () => {
            logger.info({ port: env.server.port, environment: env.server.nodeEnv }, "Server started" )
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