import { vi } from "vitest";
import type { NotificationPayload } from "@/lib/domains/notification/types";

export const notificationBroker = {
  push: vi.fn<(userId: string, payload: NotificationPayload) => void>(),
};
