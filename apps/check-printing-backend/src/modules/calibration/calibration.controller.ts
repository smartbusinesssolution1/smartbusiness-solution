import type { Request, Response } from "express";
import type { CalibrationService } from "./calibration.service.js";
import type { PdfService } from "../pdf/pdf.service.js";
import type { AdjustmentInput, TestPageQuery, VerificationInput } from "./calibration.schemas.js";
import {
  sendSuccess,
  sendCreated,
  sendNoContent,
} from "../../shared/utils/response.js";

export class CalibrationController {
  constructor(
    private readonly service: CalibrationService,
    private readonly pdfService: PdfService,
  ) {}

  private auditCtx(req: Request) {
    return {
      userId: req.user!.userId,
      tenantId: req.tenant!.tenantId,
      ipAddress: req.ip,
    };
  }

  create = async (req: Request, res: Response) => {
    const profile = await this.service.createProfile(
      req.params.wid as string,
      req.body,
      this.auditCtx(req),
    );
    sendCreated(res, profile);
  };

  list = async (req: Request, res: Response) => {
    const result = await this.service.listProfiles(req.params.wid as string);
    sendSuccess(res, result.items, 200, result.meta);
  };

  getOne = async (req: Request, res: Response) => {
    const profile = await this.service.getProfile(
      req.params.id as string,
      req.params.wid as string,
    );
    sendSuccess(res, profile);
  };

  update = async (req: Request, res: Response) => {
    const profile = await this.service.updateProfile(
      req.params.id as string,
      req.params.wid as string,
      req.body,
      this.auditCtx(req),
    );
    sendSuccess(res, profile);
  };

  setDefault = async (req: Request, res: Response) => {
    const profile = await this.service.setDefault(
      req.params.id as string,
      req.params.wid as string,
      this.auditCtx(req),
    );
    sendSuccess(res, profile);
  };

  remove = async (req: Request, res: Response) => {
    await this.service.deleteProfile(
      req.params.id as string,
      req.params.wid as string,
      this.auditCtx(req),
    );
    sendNoContent(res);
  };

  verificationPage = async (req: Request, res: Response) => {
    const pdfBuffer = await this.service.renderVerificationSample(
      req.params.id as string,
      req.params.wid as string,
    );
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "inline; filename=printer-verification-sample.pdf");
    res.setHeader("Content-Length", pdfBuffer.length);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store, must-revalidate");
    res.send(pdfBuffer);
  };

  verify = async (req: Request, res: Response) => {
    const result = await this.service.verifyProfile(
      req.params.id as string,
      req.params.wid as string,
      req.body as VerificationInput,
      this.auditCtx(req),
    );
    sendSuccess(res, result);
  };

  adjust = async (req: Request, res: Response) => {
    const profile = await this.service.adjustProfile(
      req.params.id as string,
      req.params.wid as string,
      req.body as AdjustmentInput,
      this.auditCtx(req),
    );
    sendSuccess(res, profile);
  };

  testPage = async (req: Request, res: Response) => {
    const workspaceName = req.workspace!.businessName;
    const { paperSize } = req.query as unknown as TestPageQuery;
    const pdfBuffer = await this.pdfService.generateTestPage(workspaceName, paperSize);

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `inline; filename=calibration-sheet-${paperSize.toLowerCase()}.pdf`,
    );
    res.setHeader("Content-Length", pdfBuffer.length);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store, must-revalidate");
    res.send(pdfBuffer);
  };
}
