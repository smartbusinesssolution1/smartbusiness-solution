import type { Request, Response } from "express";
import { ApprovalRuleService } from "./approval-rule.service.js";
import {
  sendSuccess,
  sendCreated,
  sendNoContent,
} from "../../shared/utils/response.js";
import type { ListApprovalRulesQuery } from "./approval-rule.schemas.js";

export class ApprovalRuleController {
  constructor(private service: ApprovalRuleService) {}

  private auditCtx(req: Request) {
    return {
      userId: req.user!.userId,
      tenantId: req.tenant!.tenantId,
      ipAddress: req.ip,
    };
  }

  create = async (req: Request, res: Response) => {
    const rule = await this.service.createRule(
      req.params.wid as string,
      req.body,
      this.auditCtx(req),
    );
    sendCreated(res, rule);
  };

  list = async (req: Request, res: Response) => {
    const query = req.query as unknown as ListApprovalRulesQuery;
    const result = await this.service.listRules(
      req.params.wid as string,
      query.includeInactive,
    );
    sendSuccess(res, result.items, 200, result.meta);
  };

  getOne = async (req: Request, res: Response) => {
    const rule = await this.service.getRule(
      req.params.ruleId as string,
      req.params.wid as string,
    );
    sendSuccess(res, rule);
  };

  update = async (req: Request, res: Response) => {
    const rule = await this.service.updateRule(
      req.params.ruleId as string,
      req.params.wid as string,
      req.body,
      this.auditCtx(req),
    );
    sendSuccess(res, rule);
  };

  activate = async (req: Request, res: Response) => {
    const rule = await this.service.activateRule(
      req.params.ruleId as string,
      req.params.wid as string,
      this.auditCtx(req),
    );
    sendSuccess(res, rule);
  };

  deactivate = async (req: Request, res: Response) => {
    const rule = await this.service.deactivateRule(
      req.params.ruleId as string,
      req.params.wid as string,
      this.auditCtx(req),
    );
    sendSuccess(res, rule);
  };

  remove = async (req: Request, res: Response) => {
    await this.service.deleteRule(
      req.params.ruleId as string,
      req.params.wid as string,
      this.auditCtx(req),
    );
    sendNoContent(res);
  };

  toggleApproval = async (req: Request, res: Response) => {
    const result = await this.service.setApprovalEnabled(
      req.params.wid as string,
      req.body.enabled,
      this.auditCtx(req),
    );
    sendSuccess(res, result);
  };

  // ─── Approver Management ────────────────────────────────

  listApprovers = async (req: Request, res: Response) => {
    const approvers = await this.service.listApprovers(
      req.params.ruleId as string,
      req.params.wid as string,
    );
    sendSuccess(res, approvers);
  };

  addApprover = async (req: Request, res: Response) => {
    const approver = await this.service.addApprover(
      req.params.ruleId as string,
      req.params.wid as string,
      req.body.userId,
      this.auditCtx(req),
    );
    sendCreated(res, approver);
  };

  removeApprover = async (req: Request, res: Response) => {
    await this.service.removeApprover(
      req.params.ruleId as string,
      req.params.wid as string,
      req.params.userId as string,
      this.auditCtx(req),
    );
    sendNoContent(res);
  };

  syncApprovers = async (req: Request, res: Response) => {
    const approvers = await this.service.syncApprovers(
      req.params.ruleId as string,
      req.params.wid as string,
      req.body.userIds,
      this.auditCtx(req),
    );
    sendSuccess(res, approvers);
  };

  listEligible = async (req: Request, res: Response) => {
    const eligible = await this.service.listEligibleApprovers(
      req.params.wid as string,
    );
    sendSuccess(res, eligible);
  };
}
