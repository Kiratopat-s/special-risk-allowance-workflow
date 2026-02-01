/**
 * Singleton Prisma Client
 * 
 * This module provides a singleton instance of the Prisma Client
 * to prevent multiple instances during development hot reloads.
 * 
 * @module lib/db/prisma
 */

import { PrismaClient } from "@/lib/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Type declaration for global prisma instance
const globalForPrisma = globalThis as unknown as {
    prisma: InstanceType<typeof PrismaClient> | undefined;
    pool: Pool | undefined;
};

/**
 * Create PostgreSQL connection pool
 */
const createPool = () => {
    return new Pool({
        connectionString: process.env.DATABASE_URL,
    });
};

/**
 * Create Prisma Client instance with PostgreSQL adapter
 */
const createPrismaClient = () => {
    const pool = globalForPrisma.pool ?? createPool();

    if (process.env.NODE_ENV !== "production") {
        globalForPrisma.pool = pool;
    }

    const adapter = new PrismaPg(pool);

    return new PrismaClient({
        adapter,
    });
};

/**
 * Singleton Prisma Client instance
 * 
 * - In production: Creates a single instance
 * - In development: Reuses the global instance to prevent hot reload issues
 */
export const prisma = globalForPrisma.prisma ?? createPrismaClient();

// Prevent multiple instances in development
if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}

/**
 * Graceful shutdown handler
 * Disconnects Prisma Client on process termination
 */
const handleShutdown = async (): Promise<void> => {
    await prisma.$disconnect();
    if (globalForPrisma.pool) {
        await globalForPrisma.pool.end();
    }
    process.exit(0);
};

process.on("SIGINT", handleShutdown);
process.on("SIGTERM", handleShutdown);

export default prisma;
