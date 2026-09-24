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

  validateRouting = async (req: Request, res: Response): Promise<void> => {
    const result = await this.bankAccountService.validateRoutingNumber(
      req.body.routingNumber,
    );
    sendSuccess(res, result);
  };
}
