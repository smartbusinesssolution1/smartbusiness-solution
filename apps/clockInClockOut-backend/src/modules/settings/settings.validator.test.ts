import { describe, it, expect } from "vitest";
import { updateSettingsSchema } from "./settings.validator.js";

describe("Organization Settings Validator", () => {
  it("validates valid organization settings and geofence", () => {
    const parsed = updateSettingsSchema.parse({
      latitude: 37.7749,
      longitude: -122.4194,
      radiusMeters: 200,
      shiftStartTime: "09:00",
      shiftEndTime: "18:00",
      graceMinutes: 15,
    });

    expect(parsed.latitude).toBe(37.7749);
    expect(parsed.radiusMeters).toBe(200);
    expect(parsed.shiftStartTime).toBe("09:00");
    expect(parsed.graceMinutes).toBe(15);
  });

  it("rejects radius exceeding 10,000 meters", () => {
    expect(() =>
      updateSettingsSchema.parse({
        latitude: 37.7749,
        longitude: -122.4194,
        radiusMeters: 10_001,
        shiftStartTime: "09:00",
        shiftEndTime: "18:00",
        graceMinutes: 15,
      })
    ).toThrow();
  });

  it("rejects non-positive radius", () => {
    expect(() =>
      updateSettingsSchema.parse({
        latitude: 37.7749,
        longitude: -122.4194,
        radiusMeters: 0,
        shiftStartTime: "09:00",
        shiftEndTime: "18:00",
        graceMinutes: 15,
      })
    ).toThrow();
  });

  it("rejects negative grace minutes", () => {
    expect(() =>
      updateSettingsSchema.parse({
        latitude: 37.7749,
        longitude: -122.4194,
        radiusMeters: 150,
        shiftStartTime: "09:00",
        shiftEndTime: "18:00",
        graceMinutes: -5,
      })
    ).toThrow();
  });
});
