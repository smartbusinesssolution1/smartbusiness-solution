import type { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/response.js";
import type { CheckFilter } from "./check-filter.js";
import type { CheckRegisterService, Viewer } from "./check-register.service.js";

export class CheckRegisterController {
  constructor(private readonly service: CheckRegisterService) {}

  private viewer(req: Request): Viewer {
    return { userId: req.user!.userId, permissions: req.permissions ?? [] };
  }

  list = async (req: Request, res: Response) => {
    const { items, meta } = await this.service.list(req.params.wid as string, req.query as unknown as CheckFilter, this.viewer(req));
    sendSuccess(res, items, 200, meta);
  };

  views = async (req: Request, res: Response) => {
    sendSuccess(res, await this.service.views(req.params.wid as string, this.viewer(req)));
  };

  numberIntegrity = async (req: Request, res: Response) => {
    const q = req.query as unknown as { bankAccountId: string; from: number; to: number };
    sendSuccess(res, await this.service.numberIntegrity(req.params.wid as string, q.bankAccountId, q.from, q.to));
  };

  aging = async (req: Request, res: Response) => {
    const q = req.query as unknown as { bankAccountId?: string };
    sendSuccess(res, await this.service.aging(req.params.wid as string, q.bankAccountId));
  };
}
