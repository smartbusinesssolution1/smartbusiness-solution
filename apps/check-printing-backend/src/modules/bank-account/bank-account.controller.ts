import { NextFunction, Request, Response } from "express";
import { BankAccountService } from "./bank-account.service.js";
import {
  sendCreated,
  sendNoContent,
  sendSuccess,
} from "../../shared/utils/response.js";

export class BankAccountController {
  private bankAccountService: BankAccountService;

  constructor(bankAccountService: BankAccountService) {
    this.bankAccountService = bankAccountService;
  }

  private auditCtx(req: Request) {
    return {
      userId: req.user!.userId,
      tenantId: req.tenant!.tenantId,
      ipAddress: req.ip,
    };
  }

  create = async (req: Request, res: Response) => {
    const account = await this.bankAccountService.createBankAccount(
      req.params.wid as string,
      req.body,
      this.auditCtx(req),
    );

    sendCreated(res, account);
  };

  list = async (req: Request, res: Response) => {
    const accounts = await this.bankAccountService.listAllBankAccounts(
      req.params.wid as string,
    );
    sendSuccess(res, accounts);
  };

  get = async (req: Request, res: Response): Promise<void> => {
    const account = await this.bankAccountService.getBankAccount(
      req.params.bid as string,
      req.params.wid as string,
    );
    sendSuccess(res, account);
  };

  update = async (req: Request, res: Response): Promise<void> => {
    const account = await this.bankAccountService.updateBankAccount(
      req.params.bid as string,
      req.params.wid as string,
      req.body,
      this.auditCtx(req),
    );
    sendSuccess(res, account);
  };

  delete = async (req: Request, res: Response): Promise<void> => {
    await this.bankAccountService.deleteBankAccount(
      req.params.bid as string,
      req.params.wid as string,
      this.auditCtx(req),
    );
    sendNoContent(res);
  };

  restore = async (req: Request, res: Response): Promise<void> => {
    const account = await this.bankAccountService.restoreBankAccount(
      req.params.bid as string,
      req.params.wid as string,
      this.auditCtx(req),
    );
    sendSuccess(res, account);
  };

  uploadSignature = async (req: Request, res: Response): Promise<void> => {
    const account = await this.bankAccountService.uploadSignature(
      req.params.bid as string,
      req.params.wid as string,
      req.file?.buffer,
      req.body?.authorized === "true",
      this.auditCtx(req),
    );
    sendSuccess(res, account);
  };

  getSignature = async (req: Request, res: Response): Promise<void> => {
    const image = await this.bankAccountService.getSignature(
      req.params.bid as string,
      req.params.wid as string,
      this.auditCtx(req),
    );
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Content-Length", image.length);
    res.setHeader("X-Content-Type-Options", "nosniff");
    // Never cached by browsers or proxies.
    res.setHeader("Cache-Control", "private, no-store, must-revalidate");
    res.send(image);
  };

  removeSignature = async (req: Request, res: Response): Promise<void> => {
    const account = await this.bankAccountService.removeSignature(
      req.params.bid as string,
      req.params.wid as string,
      this.auditCtx(req),
    );
    sendSuccess(res, account);
  };

  validateRouting = async (req: Request, res: Response): Promise<void> => {
    const result = await this.bankAccountService.validateRoutingNumber(
      req.body.routingNumber,
    );
    sendSuccess(res, result);
  };
}
