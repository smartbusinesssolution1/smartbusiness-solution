import type { Server } from "http";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { authHeaders, type TestUser, type TestWorld } from "./fixtures.js";

let server: Server | null = null;

export function getApp(): Server {
  server ??= createApp().listen(0);
  return server;
}

export function attendanceApi(world: TestWorld, user: TestUser) {
  const headers = authHeaders(user, world.workspaceId);
  const http = () => request(getApp());

  return {
    verifyLocation: (body: { latitude: number; longitude: number; workspaceId?: string }) =>
      http().post("/api/v1/attendance/verify-location").set(headers).send(body),
    clockIn: (body: Record<string, unknown>) =>
      http().post("/api/v1/attendance/clock-in").set(headers).send(body),
    clockOut: (body: Record<string, unknown> = {}) =>
      http().post("/api/v1/attendance/clock-out").set(headers).send(body),
    today: () =>
      http().get("/api/v1/attendance/today").set(headers),
  };
}
