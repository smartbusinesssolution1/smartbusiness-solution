import type { Request, Response } from "express";
import { sendSuccess } from "../../shared/utils/response.js";
import type { ExportFormat, RenderedFile } from "../export/index.js";
import type { ActivityContext, ActivityService } from "./activity.service.js";
import type { ActivityQuery, SecurityQuery } from "./activity.schemas.js";

function sendFile(res: Response, file: RenderedFile) {
  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${file.fileName}"`);
  res.setHeader("Content-Length", file.buffer.length);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Cache-Control", "private, no-store, must-revalidate");
  res.send(file.buffer);
}

export class ActivityController {
  constructor(private readonly service: ActivityService) {}

  private ctx(req: Request): ActivityContext {
    return { tenantId: req.tenant!.tenantId, userId: req.user!.userId, ipAddress: req.ip };
  }

  list = async (req: Request, res: Response) => {
    const { items, meta } = await this.service.list(req.params.wid as string, req.query as unknown as ActivityQuery);
    sendSuccess(res, items, 200, meta);
  };

  people = async (req: Request, res: Response) => {
    sendSuccess(res, await this.service.people(req.params.wid as string));
  };

  export = async (req: Request, res: Response) => {
    const format = res.locals.exportFormat as ExportFormat;
    sendFile(res, await this.service.export(req.params.wid as string, req.query as unknown as ActivityQuery, format, this.ctx(req)));
  };

  security = async (req: Request, res: Response) => {
    const { items, meta } = await this.service.security(req.tenant!.tenantId, req.params.wid as string, req.query as unknown as SecurityQuery);
    sendSuccess(res, items, 200, meta);
  };

  securityPeople = async (req: Request, res: Response) => {
    sendSuccess(res, await this.service.securityPeople(req.tenant!.tenantId));
  };

  securityExport = async (req: Request, res: Response) => {
    const format = res.locals.exportFormat as ExportFormat;
    sendFile(
      res,
      await this.service.securityExport(req.tenant!.tenantId, req.params.wid as string, req.query as unknown as SecurityQuery, format, this.ctx(req)),
    );
  };
}
