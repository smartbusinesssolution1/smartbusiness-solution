import { describe, it, expect } from "vitest";
import { UpdateProfileSchema, RegisterPushTokenSchema } from "./employee.schema.js";

describe("Employee & Profile Schemas", () => {
  describe("UpdateProfileSchema", () => {
    it("accepts valid profile updates", () => {
      const parsed = UpdateProfileSchema.parse({
        fullName: "Alex Morgan",
        phone: "+1 555-0199",
        avatarUrl: "/uploads/avatars/user-1.jpg",
        biometricPhotoUrl: "https://s3.amazonaws.com/bucket/face-1.jpg",
      });

      expect(parsed.fullName).toBe("Alex Morgan");
      expect(parsed.phone).toBe("+1 555-0199");
      expect(parsed.avatarUrl).toBe("/uploads/avatars/user-1.jpg");
    });

    it("rejects full name shorter than 2 characters", () => {
      expect(() =>
        UpdateProfileSchema.parse({
          fullName: "A",
        })
      ).toThrow();
    });
  });

  describe("RegisterPushTokenSchema", () => {
    it("accepts valid push token and supported platform", () => {
      const parsed = RegisterPushTokenSchema.parse({
        pushToken: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
        platform: "ios",
        deviceName: "iPhone 15 Pro",
      });

      expect(parsed.pushToken).toContain("ExponentPushToken");
      expect(parsed.platform).toBe("ios");
    });

    it("rejects unsupported platform", () => {
      expect(() =>
        RegisterPushTokenSchema.parse({
          pushToken: "token_123",
          platform: "windows" as any,
        })
      ).toThrow();
    });

    it("requires non-empty pushToken", () => {
      expect(() =>
        RegisterPushTokenSchema.parse({
          pushToken: "   ",
        })
      ).toThrow();
    });
  });
});
