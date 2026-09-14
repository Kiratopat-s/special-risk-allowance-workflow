/**
 * Prisma Seed Script
 * 
 * Seeds the database with default data including:
 * - Default permissions
 * - Default roles
 * - Role-permission assignments
 * - Default departments (existing records are preserved; conflicts are reported)
 * 
 * Run with: bunx prisma db seed
 */

import { seedPermissions, assignDefaultRolePermissions } from "../lib/domains/permission/seed";
import { seedDepartments } from "../lib/domains/department/seed";

async function main() {
    console.log("🌱 Starting database seed...\n");

    try {
        console.log("🏢 Creating default departments...");
        const { departmentsCreated, departmentsExisting, conflicts } = await seedDepartments();
        console.log(`✅ Created ${departmentsCreated} departments`);
        console.log(`⏭️ Skipped ${departmentsExisting} existing departments`);
        for (const conflict of conflicts) {
            console.warn(`⚠️ Department seed conflict (skipped): ${conflict}`);
        }
        console.log(`⚠️ Department conflicts: ${conflicts.length}\n`);

        // Seed permissions and roles
        console.log("📋 Creating default permissions and roles...");
        const { permissionsCreated, rolesCreated } = await seedPermissions();
        console.log(`✅ Created ${permissionsCreated} permissions`);
        console.log(`✅ Created ${rolesCreated} roles\n`);

        // Assign permissions to roles
        console.log("🔗 Assigning permissions to roles...");
        const assignmentsCreated = await assignDefaultRolePermissions();
        console.log(`✅ Created ${assignmentsCreated} role-permission assignments\n`);

        console.log(conflicts.length > 0
            ? "⚠️ Database seed completed with department conflicts; conflicting records were left unchanged."
            : "🎉 Database seed completed successfully!");
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
