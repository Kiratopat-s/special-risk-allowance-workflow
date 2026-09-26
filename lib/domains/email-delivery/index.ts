import { prisma } from "@/lib/db";
import { createEmailDeliveryService } from "./service";

export const emailDeliveryService = createEmailDeliveryService(prisma);
export * from "./types";
