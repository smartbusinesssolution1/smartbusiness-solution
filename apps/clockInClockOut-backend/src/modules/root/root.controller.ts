import { Request, Response } from 'express';
import { prisma } from "@smartbusiness/database";

export async function root(req: Request, res: Response) {
    res.status(200).json({
        message: "SmartBusiness API",
    });
}

export async function healthCheck(req: Request, res: Response) {
    let dbLatencyMs: number | null = null;
    let isDatabaseOk = false;

    try {
        const dbStart = Date.now();
        await prisma.$executeRawUnsafe("SELECT 1");
        dbLatencyMs = Date.now() - dbStart;
        isDatabaseOk = true;
    } catch {
        isDatabaseOk = false;
    }

    const status = isDatabaseOk ? "healthy" : "degraded";
    const httpStatus = isDatabaseOk ? 200 : 503;

    res.status(httpStatus).json({
        success: isDatabaseOk,
        data: {
                status,
                timestamp: new Date().toISOString(),
                uptime: process.uptime(),
                database: {
                connected: isDatabaseOk,
                latencyMs: dbLatencyMs,
            },
        },
    });
}