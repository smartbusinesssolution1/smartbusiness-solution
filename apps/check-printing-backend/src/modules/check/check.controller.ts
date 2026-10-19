import type { Request, Response } from "express";
import { PERMISSIONS } from "../../shared/constants/rbac.js";
import { CheckService } from "./check.service.js";
import {
  sendSuccess,
  sendCreated,
  sendNoContent,
} from "../../shared/utils/response.js";
import type { PrintBatchInput, PrintCheckInput } from "./check.schemas.js";

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

  printBatch = async (req: Request, res: Response) => {
    const result = await this.checkService.printBatch(
      req.params.wid as string,
      req.body as PrintBatchInput,
      this.auditCtx(req),
    );
    sendCreated(res, result);
  };

  getPrintBatch = async (req: Request, res: Response) => {
    const batch = await this.checkService.getPrintBatch(req.params.batchId as string, req.params.wid as string);
    sendSuccess(res, batch);
  };

  downloadBatchPdf = async (req: Request, res: Response) => {
    const buffer = await this.checkService.downloadBatchPdf(
      req.params.batchId as string,
      req.params.wid as string,
      this.auditCtx(req),
    );

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename=print-job-${req.params.batchId as string}.pdf`);
    res.setHeader("Content-Length", buffer.length);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store, must-revalidate");
    res.send(buffer);
  };

  printOutcome = async (req: Request, res: Response) => {
    const check = await this.checkService.recordPrintOutcome(
      req.params.checkId as string,
      req.params.wid as string,
      req.body,
      this.auditCtx(req),
    );
    sendSuccess(res, check);
  };

  voidCheck = async (req: Request, res: Response) => {
    const check = await this.checkService.voidCheck(
      req.params.checkId as string,
      req.params.wid as string,
      req.body.reason,
      this.auditCtx(req),
      { canVoidAnyCheck: (req.permissions ?? []).includes(PERMISSIONS.CHECK_VOID) },
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
