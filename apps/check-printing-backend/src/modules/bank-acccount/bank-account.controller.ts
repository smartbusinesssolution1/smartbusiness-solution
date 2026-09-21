import { NextFunction, Request, Response } from "express";
import { BanKAccountService } from "./bank-account.service.js";
import { sendCreated, sendNoContent, sendSuccess } from "../../shared/utils/response.js";


export class BankAccountController {

    private bankAccountService: BanKAccountService;

    constructor(bankAccountService: BanKAccountService) {
        this.bankAccountService = bankAccountService
    }

    create = async (req: Request, res: Response, next: NextFunction) => {
        const account = await this.bankAccountService.createBankAccount(req.params.wid as string, req.body);

        sendCreated(res, account);
    }

    list = async (req: Request, res: Response, next: NextFunction) => {
        const accounts = await this.bankAccountService.listAllBankAccounts(req.params.wid as string);
    }

    get = async (req: Request, res: Response): Promise<void> => {
        const account = await this.bankAccountService.getBankAccount(
            req.params.bid as string
        );
        sendSuccess(res, account);
    };

    update = async (req: Request, res: Response): Promise<void> => {
        const account = await this.bankAccountService.updateBankAccount(
            req.params.bid as string,
            req.body
        );
        sendSuccess(res, account);
    };

    delete = async (req: Request, res: Response): Promise<void> => {
        await this.bankAccountService.deleteBankAccount(req.params.bid as string);
        sendNoContent(res);
    };

    validateRouting = async (req: Request, res: Response): Promise<void> => {
        const result = await this.bankAccountService.validateRoutingNumber(
            req.body.routingNumber
        );
        sendSuccess(res, result);
    };

}