import { createRequire } from "module";
import type { Express } from "express";

// Lists every route the app really serves (method + full path), straight from Express,
// so a route added later can't be missed. Express 5 doesn't keep the path a router was
// mounted at (`router.use("/workspaces", workspaceRouter)`), so while the app is being
// built each mounted layer is labelled with its path, then the tree is walked.

export interface AppRoute {
  method: string;
  path: string;
}

interface Layer {
  route?: { path: string; methods: Record<string, boolean> };
  handle: { stack?: Layer[] };
  mountPath?: string;
}

interface RouterLike {
  stack: Layer[];
}

// The `router` package Express itself uses (pnpm gives each package its own copy).
const requireFromExpress = createRequire(createRequire(import.meta.url).resolve("express"));
const Router = requireFromExpress("router") as { prototype: { use: (...args: unknown[]) => unknown } };

let labelling = false;

function labelMountPaths(): void {
  if (labelling) return;
  labelling = true;
  const use = Router.prototype.use;
  Router.prototype.use = function (this: RouterLike, ...args: unknown[]) {
    const before = this.stack.length;
    const result = use.apply(this, args);
    const mountPath = typeof args[0] === "string" ? args[0] : "/";
    for (const layer of this.stack.slice(before)) layer.mountPath = mountPath;
    return result;
  };
}

function join(prefix: string, path: string): string {
  const joined = `${prefix}/${path}`.replace(/\/+/g, "/");
  return joined.length > 1 ? joined.replace(/\/$/, "") : joined;
}

function walk(router: RouterLike, prefix: string, out: AppRoute[]): void {
  for (const layer of router.stack) {
    if (layer.route) {
      for (const method of Object.keys(layer.route.methods)) {
        if (method !== "_all") out.push({ method: method.toUpperCase(), path: join(prefix, layer.route.path) });
      }
    } else if (layer.handle.stack) {
      walk(layer.handle as RouterLike, join(prefix, layer.mountPath ?? "/"), out);
    }
  }
}

// Builds a fresh app with labelling on, and returns its routes as "METHOD /path".
export async function listRoutes(): Promise<{ app: Express; routes: AppRoute[] }> {
  labelMountPaths();
  const { createApp } = await import("../../src/app.js");
  const app = createApp();
  const routes: AppRoute[] = [];
  walk((app as unknown as { router: RouterLike }).router, "", routes);
  return { app, routes };
}
