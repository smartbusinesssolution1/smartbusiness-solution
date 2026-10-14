import type { Request, Response } from "express";
import { CheckService } from "./check.service.js";
import {
  sendSuccess,
  sendCreated,
  sendNoContent,
} from "../../shared/utils/response.js";
import type { ListChecksQuery, PrintCheckInput } from "./check.schemas.js";

export class CheckController {
  constructor(private checkService: CheckService) {}

  private auditCtx(req: Request) {
    return {
      userId: req.user!.userId,
      tenantId: req.tenant!.tenantId,
      ipAddress: req.ip,
    };
  }

  create = async (req: Request, res: Response) => {
    const check = await this.checkService.createCheck(
      req.params.wid as string,
      req.body,
      this.auditCtx(req),
    );
    sendCreated(res, check);
  };

  list = async (req: Request, res: Response) => {
    const result = await this.checkService.listChecks(
      req.params.wid as string,
      req.query as unknown as ListChecksQuery,
    );
    sendSuccess(res, result.items, 200, result.meta);
  };

  approvalQueue = async (req: Request, res: Response) => {
    const items = await this.checkService.getApprovalQueue(
      req.params.wid as string,
      req.user!.userId,
    );
    sendSuccess(res, items);
  };

  getOne = async (req: Request, res: Response) => {
    const check = await this.checkService.getCheck(
      req.params.checkId as string,
      req.params.wid as string,
    );
    sendSuccess(res, check);
  };

  update = async (req: Request, res: Response) => {
    const check = await this.checkService.updateCheck(
      req.params.checkId as string,
      req.params.wid as string,
      req.body,
      this.auditCtx(req),
    );
    sendSuccess(res, check);
  };

  submitForApproval = async (req: Request, res: Response) => {
    const check = await this.checkService.submitForApproval(
      req.params.checkId as string,
      req.params.wid as string,
      this.auditCtx(req),
    );
    sendSuccess(res, check);
  };

  approve = async (req: Request, res: Response) => {
    const check = await this.checkService.approveCheck(
      req.params.checkId as string,
      req.params.wid as string,
      this.auditCtx(req),
    );
    sendSuccess(res, check);
  };

  reject = async (req: Request, res: Response) => {
    const check = await this.checkService.rejectCheck(
      req.params.checkId as string,
      req.params.wid as string,
      req.body.reason,
      this.auditCtx(req),
    );
    sendSuccess(res, check);
  };

  resubmit = async (req: Request, res: Response) => {
    const check = await this.checkService.resubmitCheck(
      req.params.checkId as string,
      req.params.wid as string,
      this.auditCtx(req),
    );
    sendSuccess(res, check);
  };

  printCheck = async (req: Request, res: Response) => {
    const check = await this.checkService.printCheck(
      req.params.checkId as string,
      req.params.wid as string,
      req.body as PrintCheckInput,
      this.auditCtx(req),
    );
    sendSuccess(res, check);
  };

  downloadPdf = async (req: Request, res: Response) => {
    const { buffer, checkNumber } = await this.checkService.downloadCheckPdf(
      req.params.checkId as string,
      req.params.wid as string,
      this.auditCtx(req),
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=check-${checkNumber}.pdf`,
    );
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store, must-revalidate");
    res.send(buffer);
  };

  voidCheck = async (req: Request, res: Response) => {
    const check = await this.checkService.voidCheck(
      req.params.checkId as string,
      req.params.wid as string,
      req.body.reason,
      this.auditCtx(req),
    );
    sendSuccess(res, check);
  };

  markCleared = async (req: Request, res: Response) => {
    const check = await this.checkService.markAsCleared(
      req.params.checkId as string,
      req.params.wid as string,
      req.body,
      this.auditCtx(req),
    );
    sendSuccess(res, check);
  };

  reissue = async (req: Request, res: Response) => {
    const check = await this.checkService.reissueCheck(
      req.params.checkId as string,
      req.params.wid as string,
      this.auditCtx(req),
    );
    sendCreated(res, check);
  };

  delete = async (req: Request, res: Response) => {
    await this.checkService.deleteCheck(
      req.params.checkId as string,
      req.params.wid as string,
      this.auditCtx(req),
    );
    sendNoContent(res);
  };
}
