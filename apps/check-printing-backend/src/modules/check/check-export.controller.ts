import type { Request, Response } from "express";
import type { ExportFormat, RenderedFile } from "../export/index.js";
import type { CheckFilter } from "./check-filter.js";
import type { CheckExportService, ExportContext, PositivePayFormat } from "./check-export.service.js";

// Sends a generated file as a download. no-store: these files hold financial data and
// must not stay in a browser or proxy cache; nosniff: the browser keeps the declared type.
function sendFile(res: Response, file: RenderedFile) {
  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
  res.setHeader("Content-Length", file.buffer.length);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store, must-revalidate");
  res.send(file.buffer);
}

export class CheckExportController {
  constructor(private readonly service: CheckExportService) {}

  private ctx(req: Request): ExportContext {
    return {
      tenantId: req.tenant!.tenantId,
      userId: req.user!.userId,
      ipAddress: req.ip,
      viewer: { userId: req.user!.userId, permissions: req.permissions ?? [] },
    };
  }

  register = async (req: Request, res: Response) => {
    const format = res.locals.exportFormat as ExportFormat;
    sendFile(res, await this.service.registerExport(req.params.wid as string, req.query as unknown as CheckFilter, format, this.ctx(req)));
  };

  outstanding = async (req: Request, res: Response) => {
    const q = req.query as unknown as { bankAccountId?: string };
    const format = res.locals.exportFormat as ExportFormat;
    sendFile(res, await this.service.outstandingExport(req.params.wid as string, q.bankAccountId, format, this.ctx(req)));
  };

  numberAudit = async (req: Request, res: Response) => {
    const q = req.query as unknown as { bankAccountId: string; from: number; to: number };
    const format = res.locals.exportFormat as ExportFormat;
    sendFile(res, await this.service.numberAuditExport(req.params.wid as string, q.bankAccountId, q.from, q.to, format, this.ctx(req)));
  };

  positivePay = async (req: Request, res: Response) => {
    const q = req.query as unknown as { bankAccountId: string; from: Date; to: Date; format: PositivePayFormat };
    sendFile(res, await this.service.positivePay(req.params.wid as string, q.bankAccountId, q.from, q.to, q.format, this.ctx(req)));
  };
}
