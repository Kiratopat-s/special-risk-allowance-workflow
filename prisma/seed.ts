/**
 * Prisma Seed Script
 * 
 * Seeds the database with default data including:
 * - Default permissions
 * - Default roles
 * - Role-permission assignments
 * 
 * Run with: bunx prisma db seed
 */

import { seedPermissions, assignDefaultRolePermissions } from "../lib/domains/permission/seed";

async function main() {
    console.log("🌱 Starting database seed...\n");

    try {
        // Seed permissions and roles
        console.log("📋 Creating default permissions and roles...");
        const { permissionsCreated, rolesCreated } = await seedPermissions();
        console.log(`✅ Created ${permissionsCreated} permissions`);
        console.log(`✅ Created ${rolesCreated} roles\n`);

        // Assign permissions to roles
        console.log("🔗 Assigning permissions to roles...");
        const assignmentsCreated = await assignDefaultRolePermissions();
        console.log(`✅ Created ${assignmentsCreated} role-permission assignments\n`);

        console.log("🎉 Database seed completed successfully!");
    } catch (error) {
        console.error("❌ Error seeding database:");
        console.error(error);
        process.exit(1);
    }
}

main()
    .catch((error) => {
        console.error("❌ Fatal error:");
        console.error(error);
        process.exit(1);
    })
    .finally(async () => {
        // Prisma client is imported within the seed functions
        // No need to disconnect here
        process.exit(0);
    });
