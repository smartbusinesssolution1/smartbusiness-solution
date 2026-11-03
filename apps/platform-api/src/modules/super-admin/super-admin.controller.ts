import type { Request, Response } from "express";
import { SuperAdminService } from "./super-admin.service.js";
import { sendCreated, sendSuccess } from "../../shared/utils/response.js";
import { server } from "../../config/index.js";

export class SuperAdminController {
  constructor(private readonly service: SuperAdminService) {}

  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const result = await this.service.login(req.body);

      // Set dedicated isolated super_admin_token cookie
      res.cookie("super_admin_token", result.token, {
        httpOnly: true,
        secure: server.isProd,
        sameSite: "lax",
        maxAge: 8 * 60 * 60 * 1000, // 8 hours
      });

      sendSuccess(res, {
        token: result.token,
        user: result.user,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Authentication failed.";
      res.status(401).json({
        success: false,
        error: message,
      });
    }
  };

  logout = async (_req: Request, res: Response): Promise<void> => {
    res.clearCookie("super_admin_token");
    sendSuccess(res, { message: "Logged out of Super Admin session." });
  };

  me = async (req: Request, res: Response): Promise<void> => {
    sendSuccess(res, req.superAdmin);
  };

  getDashboard = async (req: Request, res: Response): Promise<void> => {
    const timeRange = (req.query.timeRange as string) || "30d";
    const data = await this.service.getDashboardOverview(timeRange);
    sendSuccess(res, data);
  };

  getUsers = async (req: Request, res: Response): Promise<void> => {
    const data = await this.service.getUsers(req.query as Record<string, any>);
    sendSuccess(res, data);
  };

  unlockUser = async (req: Request, res: Response): Promise<void> => {
    const userId = req.params.userId as string;
    const data = await this.service.unlockUser(userId, req.superAdmin?.adminId);
    sendSuccess(res, data);
  };

  createOrganization = async (req: Request, res: Response): Promise<void> => {
    const data = await this.service.createOrganization(req.body, req.superAdmin?.adminId);
    sendCreated(res, data);
  };

  getPlans = async (_req: Request, res: Response): Promise<void> => {
    const data = await this.service.getPlans();
    sendSuccess(res, data);
  };

  createPlan = async (req: Request, res: Response): Promise<void> => {
    const data = await this.service.createPlan(req.body);
    sendCreated(res, data);
  };

  updatePlan = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const data = await this.service.updatePlan(id, req.body);
    sendSuccess(res, data);
  };

  deletePlan = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const data = await this.service.deletePlan(id);
    sendSuccess(res, data);
  };

  getSubscriptions = async (req: Request, res: Response): Promise<void> => {
    const data = await this.service.getSubscriptions(req.query as Record<string, any>);
    sendSuccess(res, data);
  };

  updateSubscription = async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as string;
    const data = await this.service.updateSubscription(id, req.body);
    sendSuccess(res, data);
  };

  syncStripe = async (_req: Request, res: Response): Promise<void> => {
    const data = await this.service.syncStripe();
    sendSuccess(res, data);
  };

  getTelemetryLogs = async (req: Request, res: Response): Promise<void> => {
    const data = await this.service.getTelemetryLogs(req.query as Record<string, string>);
    sendSuccess(res, data);
  };

  getTelemetryStats = async (_req: Request, res: Response): Promise<void> => {
    const data = await this.service.getTelemetryStats();
    sendSuccess(res, data);
  };
}
