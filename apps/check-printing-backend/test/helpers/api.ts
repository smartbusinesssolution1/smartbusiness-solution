import type { Server } from "http";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { authHeaders, today, type TestUser, type TestWorld } from "./fixtures.js";

let server: Server | null = null;

// The app, running on one server for the whole test file. Given the bare app, supertest
// starts and stops a server for every request; with the shared connection from
// setup/keep-alive.ts, requests now reuse one connection to one server.
export function getApp(): Server {
  server ??= createApp().listen(0);
  return server;
}

/** A thin client for the checks API, acting as one user. */
export function checksApi(world: TestWorld, user: TestUser) {
  const base = `/api/v1/workspaces/${world.workspaceId}/checks`;
  const headers = authHeaders(user);
  const http = () => request(getApp());

  return {
    create: (body: Record<string, unknown> = {}) =>
      http()
        .post(base)
        .set(headers)
        .send({
          bankAccountId: world.bankAccountId,
          payeeName: "Hill Country Supply Co.",
          amount: 1250.5,
          checkDate: today(),
          ...body,
        }),
    get: (id: string) => http().get(`${base}/${id}`).set(headers),
    update: (id: string, body: Record<string, unknown>) => http().put(`${base}/${id}`).set(headers).send(body),
    remove: (id: string) => http().delete(`${base}/${id}`).set(headers),
    submit: (id: string) => http().post(`${base}/${id}/submit`).set(headers).send({}),
    approve: (id: string) => http().post(`${base}/${id}/approve`).set(headers).send({}),
    reject: (id: string, reason = "Wrong amount") =>
      http().post(`${base}/${id}/reject`).set(headers).send({ reason }),
    resubmit: (id: string) => http().post(`${base}/${id}/resubmit`).set(headers).send({}),
    print: (id: string) => http().post(`${base}/${id}/print`).set(headers).send({}),
    pdf: (id: string) => http().get(`${base}/${id}/pdf`).set(headers),
    void: (id: string, reason = "Printed with the wrong payee") =>
      http().post(`${base}/${id}/void`).set(headers).send({ reason }),
    reissue: (id: string) => http().post(`${base}/${id}/reissue`).set(headers).send({}),
    printOutcome: (id: string, body: Record<string, unknown>) =>
      http().post(`${base}/${id}/print-outcome`).set(headers).send(body),
    list: (query: Record<string, string> = {}) => http().get(base).query(query).set(headers),
    approvalQueue: () => http().get(`${base}/approval-queue`).set(headers),
  };
}
