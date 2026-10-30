import { cors as corsConfig, server } from "../../config/index.js";

// This machine, or a private (RFC 1918) address on the local network: 10.0.0.0/8,
// 172.16.0.0/12 and 192.168.0.0/16. Only 172.16–172.31 is private; the rest of 172.* is
// the public internet.
export function isLocalNetworkOrigin(origin: string): boolean {
  let hostname: string;
  try {
    hostname = new URL(origin).hostname;
  } catch {
    return false;
  }
  if (hostname === "localhost" || hostname === "127.0.0.1") return true;
  const octets = hostname.split(".");
  if (octets.length !== 4 || !octets.every((o) => /^\d{1,3}$/.test(o) && Number(o) <= 255)) return false;
  const [a, b] = octets.map(Number) as [number, number, number, number];
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

// Our own websites: CORS lets them read our answers, the origin guard lets only them make
// changes, and links in emails (password reset) may only point to them.
export function isAllowedOrigin(origin: string): boolean {
  if ((corsConfig.origin as readonly string[]).includes(origin)) return true;
  // Phones and other computers testing against a developer's machine. Development
  // only: staging and tests are as strict as production.
  return server.isDev && isLocalNetworkOrigin(origin);
}
