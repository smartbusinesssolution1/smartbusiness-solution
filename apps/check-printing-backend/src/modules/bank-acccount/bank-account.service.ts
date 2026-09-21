import { NotFoundError } from "../../shared/errors/not-found-error.js";
import { ValidationError } from "../../shared/errors/validation-error.js";
import { encyptionService } from "../../shared/services/encryption.service.js";
import { isValidRoutingNumber, lookupRoutingNumber } from "../../shared/utils/routing-validator.js";
import { BankAccountRepository } from "./bank-account.repository.js";
import { CreateBankAccountInput, UpdateBankAccountInput } from "./bank-account.schema.js";
// create bank account ---> createBankAccount()
// update bank account ( only accountType ) ---> updateBankAccount()
// soft delete bank account --> deleteBankAccount()
// get their all bank account for a workspace --> getBankAccounts()
// can view one bank account detail ---> getBankAccountById()
// when they type routing number , then we need to check if it is correct --> validateRoutingNumsdber()

export class BanKAccountService {

    private bankAccountRepository: BankAccountRepository

    constructor(bankAccountRepository: BankAccountRepository) {
        this.bankAccountRepository = bankAccountRepository;
    }

    async createBankAccount(workspaceId: string, data: CreateBankAccountInput) {

        //1.validate the routing number 
        if (!isValidRoutingNumber(data.routingNumber)) {
            throw new ValidationError("Invalid routing number", {
                routingNumber: ["Routing number failed MOD-10 validation"]
            })
        }

        //2.Lookup for the bankAccount for this routing number 
        const lookup = lookupRoutingNumber(data.routingNumber);
        const bankName = lookup.bankName || "Unknown Bank";

        //3. encrypt sensitive data ;
        const routingNumberEncrypted = encyptionService.encrypt(data.routingNumber);
        const accountNumberEncrypted = encyptionService.encrypt(data.accountNumber);

        //4.extract last 4 digit of routing and account number ;
        const routingNumberLast4 = data.routingNumber.slice(-4);
        const accountNumberLast4 = data.accountNumber.slice(-4);

        //5.create the bank account
        const bankAccount = await this.bankAccountRepository.create({
            workspaceId: workspaceId,
            bankName: bankName,
            routingNumberEncrypted: routingNumberEncrypted,
            routingNumberLast4: routingNumberLast4,
            accountNumberEncrypted: accountNumberEncrypted,
            accountNumberLast4: accountNumberLast4,
            accountType: data.accountType,
            nextCheckNumber: data.startingCheckNumber
        })

        //6.return masked data
        return this.formattedAccountDetails(bankAccount);

    }

    async listAllBankAccounts(workspaceId: string) {
        const accounts = await this.bankAccountRepository.findByWorkspaceId(workspaceId);
        return accounts.map((a) => this.formattedAccountDetails(a));
    }

    async getBankAccount(bankAccountId: string) {
        const account = await this.bankAccountRepository.findById(bankAccountId);
        if (!account) {
            throw new NotFoundError("Bank account not found");
        }

        return this.formattedAccountDetails(account);
    }

    async updateBankAccount(bankAccountId: string, data: UpdateBankAccountInput) {
        const existing = await this.bankAccountRepository.findById(bankAccountId);

        if (!existing) {
            throw new NotFoundError("Bank account not found")
        }

        const updated = await this.bankAccountRepository.update(bankAccountId, data);

        return this.formattedAccountDetails(updated);
    }

    async deleteBankAccount(bankAccountId: string) {
        const existing = await this.bankAccountRepository.findById(bankAccountId);

        if (!existing) {
            throw new NotFoundError("Bank account not found")
        }

        await this.bankAccountRepository.softDelete(bankAccountId);
    }

    // ── Used internally by the PDF service (NOT exposed via API) ──
    async getDecryptedBankData(bankAccountId: string) {
        const account = await this.bankAccountRepository.findById(bankAccountId);
        if (!account) {
            throw new NotFoundError("Bank account");
        }

        return {
            routingNumber: encyptionService.decrypt(account.routingNumberEncrypted),
            accountNumber: encyptionService.decrypt(account.accountNumberEncrypted),
            bankName: account.bankName,
            checkNumberPadding: account.checkNumberPadding,
        };
    }

    async validateRoutingNumber(routingNumber: string) {
        return lookupRoutingNumber(routingNumber);
    }


    private formattedAccountDetails(data: any) {
        return {
            id: data.id,
            bankName: data.bankName,
            routingNumber: `*****${data.routingNumberLast4}`,
            accountNumber: `*****${data.accountNumberLast4}`,
            accountType: data.accountType,
            nextCheckNumber: data.nextCheckNumber,
            checkNumberPadding: data.checkNumberPadding,
            signatureImageUrl: data.signatureImageUrl,
            isActive: data.isActive,
            createdAt: data.createdAt
        }
    }


}