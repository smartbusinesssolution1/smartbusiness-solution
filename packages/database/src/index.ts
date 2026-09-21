import { PrismaClient } from "../generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as {
    prisma?: PrismaClient;
};

function createPrismaClient() {
    const connectionString = process.env.DATABASE_URL;

    if (!connectionString) {
        throw new Error(
            "DATABASE_URL environment variable is not set."
        );
    }

    const pool = new Pool({
        connectionString,
        max: parseInt(process.env.DB_POOL_MAX || "10", 10),
        connectionTimeoutMillis: 50000,
        idleTimeoutMillis: 30000, // Close idle connections after 30s
    });

    // Prevent unhandled idle connection crashes
    pool.on("error", (err) => {
        console.error("Unexpected error on idle database client", err);
    });

    const adapter = new PrismaPg(pool);

    return new PrismaClient({
        adapter,
    });
}

export const prisma =
    globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}

export * from "../generated/prisma/client.js";
