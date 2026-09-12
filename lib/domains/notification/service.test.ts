vi.mock("./repository");
// Redirect to mock modules so concurrent lazy imports all share the same mocks.
// Factory mocks can fall through to the real modules during sendToMany().
vi.mock("@/lib/notification-broker");
vi.mock("@/lib/web-push");

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

const mockBroker = vi.mocked(notificationBroker);
const mockWebPush = vi.mocked(sendWebPush);

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
    vi.resetAllMocks();
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(async () => {
    // send() returns before its lazy delivery imports finish. Drain them even
    // when an assertion fails, before Vitest restores mocks or closes the worker.
    await vi.dynamicImportSettled();
    vi.restoreAllMocks();
  });

  describe("send", () => {
    it("creates notification in repo and delivers to SSE and Web Push", async () => {
      const entity = makeEntity();
      repo.create.mockResolvedValue(entity);
      mockWebPush.mockResolvedValue(undefined);

      await notificationService.send("u1", "SYSTEM_ANNOUNCEMENT" as any, "Test", "Body");
      await vi.dynamicImportSettled();

      expect(repo.create).toHaveBeenCalledExactlyOnceWith({
        userId: "u1", type: "SYSTEM_ANNOUNCEMENT", title: "Test", body: "Body", link: undefined,
      });
      const payload = {
        id: entity.id, type: entity.type, title: entity.title, body: entity.body,
        link: entity.link, createdAt: entity.createdAt.toISOString(),
      };
      expect(mockBroker.push).toHaveBeenCalledExactlyOnceWith("u1", payload);
      expect(mockWebPush).toHaveBeenCalledExactlyOnceWith("u1", payload);
    });

    it("does not throw when repository fails", async () => {
      repo.create.mockRejectedValue(new Error("db down"));

      await expect(
        notificationService.send("u1", "SYSTEM_ANNOUNCEMENT" as any, "Test", "Body")
      ).resolves.toBeUndefined();
      await vi.dynamicImportSettled();

      expect(mockBroker.push).not.toHaveBeenCalled();
      expect(mockWebPush).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith("[notification-service] send() failed:", expect.any(Error));
    });

    it("logs SSE delivery failures and still delivers Web Push", async () => {
      const failure = new Error("SSE unavailable");
      repo.create.mockResolvedValue(makeEntity());
      mockBroker.push.mockImplementation(() => { throw failure; });
      mockWebPush.mockResolvedValue(undefined);

      await expect(
        notificationService.send("u1", "SYSTEM_ANNOUNCEMENT", "Test", "Body")
      ).resolves.toBeUndefined();
      await vi.dynamicImportSettled();

      expect(mockWebPush).toHaveBeenCalledExactlyOnceWith("u1", expect.any(Object));
      expect(console.error).toHaveBeenCalledWith("[notification-service] SSE push failed:", failure);
    });

    it("handles rejected Web Push delivery without an unhandled rejection", async () => {
      const failure = new Error("Push unavailable");
      repo.create.mockResolvedValue(makeEntity());
      mockWebPush.mockRejectedValue(failure);

      await expect(
        notificationService.send("u1", "SYSTEM_ANNOUNCEMENT", "Test", "Body")
      ).resolves.toBeUndefined();
      await vi.dynamicImportSettled();

      expect(mockBroker.push).toHaveBeenCalledExactlyOnceWith("u1", expect.any(Object));
      expect(console.error).toHaveBeenCalledWith("[notification-service] Web Push failed:", failure);
    });
  });

  describe("sendToMany", () => {
    it.each([0, 3, 25])("delivers through both channels for a %i-user broadcast", async (count) => {
      const userIds = Array.from({ length: count }, (_, index) => `u${index + 1}`);
      const entity = makeEntity();
      repo.create.mockResolvedValue(entity);
      mockWebPush.mockResolvedValue(undefined);

      await notificationService.sendToMany(
        userIds,
        "SYSTEM_ANNOUNCEMENT" as any,
        "Test",
        "Body"
      );
      await vi.dynamicImportSettled();

      expect(repo.create).toHaveBeenCalledTimes(count);
      expect(mockBroker.push).toHaveBeenCalledTimes(count);
      expect(mockWebPush).toHaveBeenCalledTimes(count);
      for (const userId of userIds) {
        expect(mockBroker.push).toHaveBeenCalledWith(userId, expect.objectContaining({ id: entity.id }));
        expect(mockWebPush).toHaveBeenCalledWith(userId, expect.objectContaining({ id: entity.id }));
      }
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
