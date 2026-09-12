import { vi } from "vitest";
import type { NotificationPayload } from "@/lib/domains/notification/types";

export const sendWebPush = vi.fn<(userId: string, payload: NotificationPayload) => Promise<void>>();
