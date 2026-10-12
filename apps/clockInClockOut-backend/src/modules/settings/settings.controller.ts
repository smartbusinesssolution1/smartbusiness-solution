import { Request, Response } from "express";

// Zod Schemas
import { updateSettingsSchema } from "./settings.validator";

// Services
import { svcGetSettings, svcUpdateSettings } from "./settings.service";

export async function ctrlGetSettings(req: Request, res: Response) {
  try {
    const response = await svcGetSettings(req.body.workspaceId)
    return res.json(response)
  }
  catch (err: any) {
    if (err.status) {
      return res.status(err.status).json({ error: err.message })
    }
    console.error('Settings controller error', err);
    return res.status(500).json({ error: 'Internal server error' })
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