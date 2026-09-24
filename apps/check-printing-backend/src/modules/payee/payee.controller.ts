import { Request, Response } from "express";
import { PayeeService } from "./payee.service.js";
import { sendSuccess, sendCreated } from "../../shared/utils/response.js";
import type { ListPayeesQuery } from "./payee.schema.js";

export class PayeeController {
  private payeeService: PayeeService;

  constructor(payeeService: PayeeService) {
    this.payeeService = payeeService;
  }

  private auditCtx(req: Request) {
    return {
      userId: req.user!.userId,
      tenantId: req.tenant!.tenantId,
      ipAddress: req.ip,
    };
  }

  create = async (req: Request, res: Response): Promise<void> => {
    const payee = await this.payeeService.createPayee(
      req.params.wid as string,
      req.body,
      this.auditCtx(req),
    );
    sendCreated(res, payee);
  };

  list = async (req: Request, res: Response): Promise<void> => {
    // Validate query parameters
    const query = req.query as unknown as ListPayeesQuery;

    const result = await this.payeeService.listPayees(
      req.params.wid as string,
      query,
    );
    sendSuccess(res, result.items, 200, result.meta);
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const payee = await this.payeeService.getPayee(
      req.params.pid as string,
      req.params.wid as string,
    );
    sendSuccess(res, payee);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const payee = await this.payeeService.updatePayee(
      req.params.pid as string,
      req.params.wid as string,
      req.body,
      this.auditCtx(req),
    );
    sendSuccess(res, payee);
  };

  archive = async (req: Request, res: Response): Promise<void> => {
    const payee = await this.payeeService.archivePayee(
      req.params.pid as string,
      req.params.wid as string,
      this.auditCtx(req),
    );
    sendSuccess(res, payee);
  };

  restore = async (req: Request, res: Response): Promise<void> => {
    const payee = await this.payeeService.restorePayee(
      req.params.pid as string,
      req.params.wid as string,
      this.auditCtx(req),
    );
    sendSuccess(res, payee);
  };
}
