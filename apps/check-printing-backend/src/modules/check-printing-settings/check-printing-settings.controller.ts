import type { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/response.js";
import type { CheckPrintingSettingsService } from "./check-printing-settings.service.js";
import type { UpdateCheckPrintingSettingsInput } from "./check-printing-settings.schemas.js";

export class CheckPrintingSettingsController {
  constructor(private readonly service: CheckPrintingSettingsService) {}

  get = async (req: Request, res: Response) => {
    sendSuccess(res, await this.service.get(req.params.wid as string));
  };

  update = async (req: Request, res: Response) => {
    const settings = await this.service.updateLimits(
      req.params.wid as string,
      req.body as UpdateCheckPrintingSettingsInput,
      { userId: req.user!.userId, tenantId: req.tenant!.tenantId, ipAddress: req.ip },
    );
    sendSuccess(res, settings);
  };
}
