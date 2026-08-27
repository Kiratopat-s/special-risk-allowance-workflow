vi.mock("./repository");
vi.mock("@/lib/notification-broker", () => ({
  notificationBroker: { push: vi.fn() },
}));
vi.mock("@/lib/web-push", () => ({
  sendWebPush: vi.fn(),
}));

import { notificationRepository } from "./repository";
import { notificationBroker } from "@/lib/notification-broker";
import { sendWebPush } from "@/lib/web-push";
import { notificationService } from "./service";

const repo = notificationRepository as unknown as {
  create: vi.Mock;
  findByUserId: vi.Mock;
  countUnread: vi.Mock;
  markRead: vi.Mock;
  markAllRead: vi.Mock;
  softDelete: vi.Mock;
  softDeleteAllRead: vi.Mock;
  savePushSubscription: vi.Mock;
  deletePushSubscriptionByEndpoint: vi.Mock;
};

const mockBroker = notificationBroker as unknown as { push: vi.Mock };
const mockWebPush = sendWebPush as unknown as vi.Mock;

const makeEntity = () => ({
  id: "n1",
  type: "SYSTEM_ANNOUNCEMENT",
  title: "Test",
  body: "Body",
  link: null,
  isRead: false,
  readAt: null,
  createdAt: new Date(),
});

describe("notificationService", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  describe("send", () => {
    it("creates notification in repo and pushes to SSE broker", async () => {
      const entity = makeEntity();
      repo.create.mockResolvedValue(entity);
      mockBroker.push.mockReturnValue(true);
      mockWebPush.mockResolvedValue(undefined);

      await notificationService.send("u1", "SYSTEM_ANNOUNCEMENT" as any, "Test", "Body");
      await new Promise((r) => setTimeout(r, 50)); // flush fire-and-forget

      expect(repo.create).toHaveBeenCalled();
      expect(mockBroker.push).toHaveBeenCalled();
    });

    it("does not throw when repository fails", async () => {
      repo.create.mockRejectedValue(new Error("db down"));

      await expect(
        notificationService.send("u1", "SYSTEM_ANNOUNCEMENT" as any, "Test", "Body")
      ).resolves.toBeUndefined();
      await new Promise((r) => setTimeout(r, 50)); // flush fire-and-forget
    });
  });

  describe("sendToMany", () => {
    it("sends to each user", async () => {
      const entity = makeEntity();
      repo.create.mockResolvedValue(entity);
      mockBroker.push.mockReturnValue(true);
      mockWebPush.mockResolvedValue(undefined);

      await notificationService.sendToMany(
        ["u1", "u2", "u3"],
        "SYSTEM_ANNOUNCEMENT" as any,
        "Test",
        "Body"
      );
      await new Promise((r) => setTimeout(r, 50)); // flush fire-and-forget

      expect(repo.create).toHaveBeenCalledTimes(3);
    });
  });

  describe("savePushSubscription", () => {
    it("rejects when fields are missing", async () => {
      const result = await notificationService.savePushSubscription("u1", "", "key", "auth");

      expect(result.success).toBe(false);
      if (!result.success) expect(result.code).toBe("INVALID_PUSH_SUB");
    });

    it("saves valid subscription", async () => {
      repo.savePushSubscription.mockResolvedValue({});

      const result = await notificationService.savePushSubscription(
        "u1",
        "https://endpoint.example.com",
        "p256dh-key",
        "auth-key"
      );

      expect(result.success).toBe(true);
      expect(repo.savePushSubscription).toHaveBeenCalled();
    });
  });

  describe("getPage", () => {
    it("returns paginated notifications", async () => {
      const pageResult = { data: [makeEntity()], pagination: { page: 1, pageSize: 20, total: 1, totalPages: 1, hasNext: false, hasPrevious: false } };
      repo.findByUserId.mockResolvedValue(pageResult);

      const result = await notificationService.getPage("u1");

      expect(result.success).toBe(true);
      if (result.success) expect(result.data.data).toHaveLength(1);
    });
  });

  describe("markRead", () => {
    it("delegates to repository", async () => {
      repo.markRead.mockResolvedValue({});

      const result = await notificationService.markRead("n1", "u1");

      expect(result.success).toBe(true);
      expect(repo.markRead).toHaveBeenCalledWith("n1", "u1");
    });
  });

  describe("markAllRead", () => {
    it("delegates to repository", async () => {
      repo.markAllRead.mockResolvedValue({});

      const result = await notificationService.markAllRead("u1");

      expect(result.success).toBe(true);
      expect(repo.markAllRead).toHaveBeenCalledWith("u1");
    });
  });

  describe("softDelete", () => {
    it("delegates to repository", async () => {
      repo.softDelete.mockResolvedValue({});

      const result = await notificationService.softDelete("n1", "u1");

      expect(result.success).toBe(true);
      expect(repo.softDelete).toHaveBeenCalledWith("n1", "u1");
    });
  });
});
