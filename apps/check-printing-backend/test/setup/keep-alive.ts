import { Agent } from "http";
import { createRequire } from "module";

// Every supertest request reuses one kept-alive connection.
//
// superagent (what supertest sends with) opts out of connection reuse by default
// (`agent: false`): a new TCP connection for every request. Hundreds of them in quick
// succession, client and server in the same process, made the Windows test worker abort
// itself now and then (exit code 0xC0000409, no JavaScript error). The file then stopped
// mid-way and its remaining tests were reported as skipped, not failed, so a run could look
// green with tests that never ran. Together with one server per file (getApp in
// helpers/api.ts), requests now share a connection, and the crash is gone.
const require = createRequire(createRequire(import.meta.url).resolve("supertest"));
const { Request } = require("superagent") as { Request: { prototype: { request: () => unknown; _agent: unknown } } };

const KEEP_ALIVE = new Agent({ keepAlive: true });
const send = Request.prototype.request;

Request.prototype.request = function (this: { _agent: unknown }) {
  // Only when the test didn't choose an agent itself.
  if (this._agent === false) this._agent = KEEP_ALIVE;
  return send.call(this);
};
