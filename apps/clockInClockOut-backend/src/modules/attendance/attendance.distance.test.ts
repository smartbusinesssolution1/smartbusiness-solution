import { describe, it, expect } from "vitest";
import { calculateHaversineDistanceMeters } from "./attendance.service.js";

describe("calculateHaversineDistanceMeters", () => {
  it("returns 0 meters when comparing identical coordinates", () => {
    const lat = 37.7749;
    const lon = -122.4194;
    const distance = calculateHaversineDistanceMeters(lat, lon, lat, lon);
    expect(distance).toBe(0);
  });

  it("calculates accurate distance between known close points", () => {
    // Two points roughly ~111 meters apart (0.001 degree latitude diff)
    const lat1 = 37.7749;
    const lon1 = -122.4194;
    const lat2 = 37.7759;
    const lon2 = -122.4194;

    const distance = calculateHaversineDistanceMeters(lat1, lon1, lat2, lon2);
    // Approximately 111.2 meters
    expect(distance).toBeGreaterThan(110);
    expect(distance).toBeLessThan(113);
  });

  it("is symmetric regardless of coordinate order", () => {
    const latA = 40.7128;
    const lonA = -74.006;
    const latB = 34.0522;
    const lonB = -118.2437;

    const d1 = calculateHaversineDistanceMeters(latA, lonA, latB, lonB);
    const d2 = calculateHaversineDistanceMeters(latB, lonB, latA, lonA);
    expect(d1).toBe(d2);
    // NYC to LA is ~3,935 km (~3.935e6 m)
    expect(d1).toBeGreaterThan(3_900_000);
    expect(d1).toBeLessThan(4_000_000);
  });
});
