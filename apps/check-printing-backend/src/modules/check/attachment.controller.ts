import type { Request, Response } from "express";
import { sendCreated, sendNoContent, sendSuccess } from "../../shared/utils/response.js";
import { attachmentDisposition } from "../../shared/utils/file-name.js";
import type { AttachmentService } from "./attachment.service.js";

export class AttachmentController {
  constructor(private readonly service: AttachmentService) {}

  private auditCtx(req: Request) {
    return { userId: req.user!.userId, tenantId: req.tenant!.tenantId, ipAddress: req.ip };
  }

  upload = async (req: Request, res: Response) => {
    const attachment = await this.service.upload(
      req.params.checkId as string,
      req.params.wid as string,
      req.file,
      this.auditCtx(req),
    );
    sendCreated(res, attachment);
  };

  list = async (req: Request, res: Response) => {
    sendSuccess(res, await this.service.list(req.params.checkId as string, req.params.wid as string));
  };

  download = async (req: Request, res: Response) => {
    const { content, fileName, fileType } = await this.service.download(
      req.params.checkId as string,
      req.params.attachmentId as string,
      req.params.wid as string,
      this.auditCtx(req),
    );
    res.setHeader("Content-Type", fileType);
    // Always a file to save, never opened inside our web pages.
    res.setHeader("Content-Disposition", attachmentDisposition(fileName));
    res.setHeader("Content-Length", content.length);
    res.setHeader("X-Content-Type-Options", "nosniff");
    // If a browser renders it anyway, it gets no scripts, no network, no access to our site.
    res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
    res.setHeader("Cache-Control", "private, no-store, must-revalidate");
    res.send(content);
  };

  remove = async (req: Request, res: Response) => {
    await this.service.remove(
      req.params.checkId as string,
      req.params.attachmentId as string,
      req.params.wid as string,
      this.auditCtx(req),
    );
    sendNoContent(res);
  };
}
