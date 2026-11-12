import { describe, it, expect, vi, beforeEach } from "vitest";
import { pushNotificationService } from "./push-notification.service.js";
import { memoryCache } from "./cache.service.js";

describe("PushNotificationService", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    memoryCache.clear();
  });

  describe("Token Management", () => {
    it("saves and retrieves push token by user ID and employee ID", async () => {
      const userId = "usr-123";
      const empId = "emp-456";
      const token = "ExponentPushToken[AbCdEf1234567890]";

      await pushNotificationService.savePushToken(userId, token, empId);

      const retrievedByUser = await pushNotificationService.getPushToken(userId);
      const retrievedByEmp = await pushNotificationService.getPushTokenByEmployeeId(empId);

      expect(retrievedByUser).toBe(token);
      expect(retrievedByEmp).toBe(token);
    });

    it("ignores empty or invalid tokens", async () => {
      await pushNotificationService.savePushToken("usr-empty", "");
      const res = await pushNotificationService.getPushToken("usr-empty");
      expect(res).toBeUndefined();
    });

    it("removes tokens on demand", async () => {
      const userId = "usr-delete";
      const empId = "emp-delete";
      await pushNotificationService.savePushToken(userId, "token_xyz", empId);

      await pushNotificationService.removePushToken(userId, empId);

      expect(await pushNotificationService.getPushToken(userId)).toBeUndefined();
      expect(await pushNotificationService.getPushTokenByEmployeeId(empId)).toBeUndefined();
    });
  });

  describe("Push Dispatch", () => {
    it("returns error if no token is registered", async () => {
      const result = await pushNotificationService.sendPushNotification({
        userId: "non-existent-user",
        title: "Test Title",
        body: "Test Body",
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe("No push token registered");
    });

    it("handles simulated dev tokens cleanly without calling external network", async () => {
      const devToken = "ExponentPushToken[dev_android_api33_abcdef12]";
      await pushNotificationService.savePushToken("usr-dev", devToken);

      const result = await pushNotificationService.sendPushNotification({
        userId: "usr-dev",
        title: "Leave Approved",
        body: "Your CA Sick Leave was approved",
        data: { type: "LEAVE_STATUS_UPDATE", status: "APPROVED" },
      });

      expect(result.success).toBe(true);
      expect(result.simulated).toBe(true);
    });

    it("dispatches HTTP request for valid Expo token", async () => {
      const validToken = "ExponentPushToken[REAL_DEVICE_TOKEN_12345]";
      await pushNotificationService.savePushToken("usr-prod", validToken);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          data: [{ id: "ticket-12345", status: "ok" }],
        }),
      });
      global.fetch = mockFetch;

      const result = await pushNotificationService.sendPushNotification({
        userId: "usr-prod",
        title: "Leave Request Approved 🎉",
        body: "Your Vacation Leave was approved",
        data: { type: "LEAVE_STATUS_UPDATE", status: "APPROVED" },
      });

      expect(result.success).toBe(true);
      expect(result.ticketId).toBe("ticket-12345");
      expect(mockFetch).toHaveBeenCalledTimes(1);

      const [url, requestInit] = mockFetch.mock.calls[0];
      expect(url).toBe("https://exp.host/--/api/v2/push/send");
      const sentBody = JSON.parse(requestInit.body);
      expect(sentBody.to).toBe(validToken);
      expect(sentBody.title).toBe("Leave Request Approved 🎉");
      expect(sentBody.channelId).toBe("leaves");
    });

    it("handles external Expo HTTP error gracefully without throwing", async () => {
      const validToken = "ExponentPushToken[EXPO_TOKEN_SERVER_ERROR]";
      await pushNotificationService.savePushToken("usr-err", validToken);

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      const result = await pushNotificationService.sendPushNotification({
        userId: "usr-err",
        title: "Alert",
        body: "Testing failure",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("HTTP 500");
    });
  });
});
