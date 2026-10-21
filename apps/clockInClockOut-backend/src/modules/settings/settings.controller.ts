import { Request, Response } from "express";

// Zod Schemas
import { updateSettingsSchema } from "./settings.validator";

// Services
import { svcGetSettings, svcUpdateSettings } from "./settings.service";

import { prisma } from "@smartbusiness/database";

export async function ctrlGetSettings(req: Request, res: Response) {
  try {
    let workspaceId =
      (req.headers["x-workspace-id"] as string) ||
      (req.query.workspaceId as string) ||
      req.body?.workspaceId;

    if (!workspaceId && req.tenant?.tenantId) {
      const defaultWs = await prisma.workspace.findFirst({
        where: { tenantId: req.tenant.tenantId, deletedAt: null },
        orderBy: { createdAt: "asc" },
        select: { id: true },
      });
      workspaceId = defaultWs?.id;
    }

    if (!workspaceId) {
      return res.status(400).json({ error: "X-Workspace-Id header or workspaceId is required" });
    }

    const response = await svcGetSettings(workspaceId);
    return res.json({ success: true, data: response });
  }
  catch (err: any) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message });
    }
    console.error('Settings controller error', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}


export async function ctrlUpdateSettings(req: Request, res: Response) {
  const validReq = updateSettingsSchema.safeParse(req.body);
  if (!validReq.success) {
    return res.status(400).json({ error: validReq.error.issues[0].message });
  }

  try {
    const response = await svcUpdateSettings(req.body.workspaceId, validReq.data)
    return res.json(response)
  }
  catch (err: any) {
    if (err.status) return res.status(err.status).json({ error: err.message })
    console.error('Settings controller error', err);
    return res.status(500).json({ error: 'Internal server error' })
  }
}