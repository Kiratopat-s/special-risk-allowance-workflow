import { prisma } from "@/lib/db";
import { createEmailDeliveryService } from "./service";
import { createEmailDashboardService } from "./dashboard-service";

export const emailDeliveryService = createEmailDeliveryService(prisma);
export const emailDashboardService = createEmailDashboardService(prisma);
export * from "./types";
export * from "./dashboard-types";
