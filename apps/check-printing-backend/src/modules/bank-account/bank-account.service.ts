import { NotFoundError } from "../../shared/errors/not-found-error.js";
import { ValidationError } from "../../shared/errors/validation-error.js";
import { encryptionService } from "../../shared/services/encryption.service.js";
import { AuditService } from "../../shared/services/audit.service.js";
import {
  isValidRoutingNumber,
  lookupRoutingNumber,
} from "../../shared/utils/routing-validator.js";
import { BankAccountRepository } from "./bank-account.repository.js";
import {
  CreateBankAccountInput,
  UpdateBankAccountInput,
} from "./bank-account.schema.js";
import { prisma } from "@smartbusiness/database";
import { randomUUID } from "crypto";
import { StorageNotFoundError, type ObjectStorage } from "../../shared/storage/index.js";
import { cleanSignatureImage, SignatureImageError } from "./signature-image.js";
// create bank account ---> createBankAccount()
// update bank account ( only accountType ) ---> updateBankAccount()
// soft delete bank account --> deleteBankAccount()
// get their all bank account for a workspace --> getBankAccounts()
// can view one bank account detail ---> getBankAccountById()
// when they type routing number , then we need to check if it is correct --> validateRoutingNumsdber()

interface AuditContext {
  userId: string;
  tenantId: string;
  ipAddress?: string;
}

export class BankAccountService {
  private bankAccountRepository: BankAccountRepository;
  private auditService: AuditService;

  private fileStorage: ObjectStorage;

  constructor(
    bankAccountRepository: BankAccountRepository,
    auditService: AuditService,
    fileStorage: ObjectStorage,
  ) {
    this.bankAccountRepository = bankAccountRepository;
    this.auditService = auditService;
    this.fileStorage = fileStorage;
  }

  // ═════════════════════════════════════════════════════════════
  // SIGNATURE
  //
  // The image printed on the signature line of every check from this account. It is
  // enough to forge checks, so: admins only (route), cleaned and re-encoded (no
  // metadata), stored encrypted, every change and every view audited, and the old
  // file kept so "which signature was valid in March?" stays answerable.
  // ═════════════════════════════════════════════════════════════

  async uploadSignature(
    bankAccountId: string,
    workspaceId: string,
    upload: Buffer | undefined,
    authorized: boolean,
    ctx: AuditContext,
  ) {
    if (!authorized) {
      throw new ValidationError("Confirm that you are authorized to provide this signature", {
        authorized: ["You must confirm you are authorized to provide this signature for this account"],
      });
    }
    if (!upload) {
      throw new SignatureImageError("Attach the signature image in the \"signature\" field.", 400, "MISSING_FILE");
    }

    // Before any processing: is this account in this workspace?
    const account = await this.bankAccountRepository.findById(bankAccountId, workspaceId);
    if (!account) throw new NotFoundError("Bank account");

    const clean = await cleanSignatureImage(upload);

    // A new file per upload: replacing a signature never overwrites the old one.
    const key = `signatures/${workspaceId}/${bankAccountId}-${randomUUID()}.png`;
    await this.fileStorage.put(key, clean.png, "image/png");

    const result = await this.bankAccountRepository.setSignature(bankAccountId, workspaceId, key, ctx.userId);
    if (!result) {
      await this.fileStorage.delete(key);
      throw new NotFoundError("Bank account");
    }

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: result.previousKey ? "SIGNATURE_REPLACED" : "SIGNATURE_UPLOADED",
      entityType: "BankAccount",
      entityId: bankAccountId,
      details: {
        authorizedAttestation: true,
        storageKey: key,
        previousStorageKey: result.previousKey,
        width: clean.width,
        height: clean.height,
      },
      ipAddress: ctx.ipAddress,
    });

    return this.formattedAccountDetails(result.account);
  }

  async getSignature(bankAccountId: string, workspaceId: string, ctx: AuditContext): Promise<Buffer> {
    const account = await this.bankAccountRepository.findById(bankAccountId, workspaceId);
    if (!account) throw new NotFoundError("Bank account");
    if (!account.signatureStorageKey) throw new NotFoundError("Signature");

    let image: Buffer;
    try {
      image = await this.fileStorage.get(account.signatureStorageKey);
    } catch (err) {
      if (err instanceof StorageNotFoundError) throw new NotFoundError("Signature");
      throw err;
    }

    // Seeing the image is enough to forge it: every view is recorded.
    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "SIGNATURE_VIEWED",
      entityType: "BankAccount",
      entityId: bankAccountId,
      ipAddress: ctx.ipAddress,
    });
    return image;
  }

  async removeSignature(bankAccountId: string, workspaceId: string, ctx: AuditContext) {
    const result = await this.bankAccountRepository.setSignature(bankAccountId, workspaceId, null, ctx.userId);
    if (!result) throw new NotFoundError("Bank account");

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "SIGNATURE_REMOVED",
      entityType: "BankAccount",
      entityId: bankAccountId,
      details: { previousStorageKey: result.previousKey },
      ipAddress: ctx.ipAddress,
    });
    return this.formattedAccountDetails(result.account);
  }

  async createBankAccount(
    workspaceId: string,
    data: CreateBankAccountInput,
    ctx: AuditContext,
  ) {
    //1.validate the routing number
    if (!isValidRoutingNumber(data.routingNumber)) {
      throw new ValidationError("Invalid routing number", {
        routingNumber: ["Routing number failed MOD-10 validation"],
      });
    }

    //2.Lookup for the bankAccount for this routing number
    const lookup = lookupRoutingNumber(data.routingNumber);
    const bankName = lookup.bankName || "Unknown Bank";

    //3. encrypt sensitive data ;
    const routingNumberEncrypted = encryptionService.encrypt(
      data.routingNumber,
    );
    const accountNumberEncrypted = encryptionService.encrypt(
      data.accountNumber,
    );

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
      nextCheckNumber: data.startingCheckNumber,
    });

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "BANK_ACCOUNT_CREATED",
      entityType: "BankAccount",
      entityId: bankAccount.id,
      details: { bankName, accountType: data.accountType },
      ipAddress: ctx.ipAddress,
    });

    //6.return masked data
    return this.formattedAccountDetails(bankAccount);
  }

  async listAllBankAccounts(workspaceId: string) {
    const accounts =
      await this.bankAccountRepository.findByWorkspaceId(workspaceId);
    return accounts.map((a) => this.formattedAccountDetails(a));
  }

  async getBankAccount(bankAccountId: string, workspaceId: string) {
    const account = await this.bankAccountRepository.findById(
      bankAccountId,
      workspaceId,
    );
    if (!account) {
      throw new NotFoundError("Bank account not found");
    }

    return this.formattedAccountDetails(account);
  }

  async updateBankAccount(
    bankAccountId: string,
    workspaceId: string,
    data: UpdateBankAccountInput,
    ctx: AuditContext,
  ) {
    const existing = await this.bankAccountRepository.findById(
      bankAccountId,
      workspaceId,
    );

    if (!existing) {
      throw new NotFoundError("Bank account not found");
    }

    const updated = await this.bankAccountRepository.update(
      bankAccountId,
      workspaceId,
      data,
    );

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "BANK_ACCOUNT_UPDATED",
      entityType: "BankAccount",
      entityId: bankAccountId,
      details: { fields: Object.keys(data) },
      ipAddress: ctx.ipAddress,
    });

    return this.formattedAccountDetails(updated);
  }

  async deleteBankAccount(
    bankAccountId: string,
    workspaceId: string,
    ctx: AuditContext,
  ) {
    const existing = await this.bankAccountRepository.findById(
      bankAccountId,
      workspaceId,
    );

    if (!existing) {
      throw new NotFoundError("Bank account not found");
    }

    await this.bankAccountRepository.softDelete(bankAccountId, workspaceId);

    await this.auditService.log({
      tenantId: ctx.tenantId,
      userId: ctx.userId,
      workspaceId,
      action: "BANK_ACCOUNT_DELETED",
      entityType: "BankAccount",
      entityId: bankAccountId,
      details: { bankName: existing.bankName },
      ipAddress: ctx.ipAddress,
    });
  }

  // ── Used internally by the PDF service (NOT exposed via API) ──
  async getDecryptedBankData(bankAccountId: string, workspaceId: string) {
    const account = await this.bankAccountRepository.findById(
      bankAccountId,
      workspaceId,
    );
    if (!account) {
      throw new NotFoundError("Bank account");
    }

    return {
      routingNumber: encryptionService.decrypt(account.routingNumberEncrypted),
      accountNumber: encryptionService.decrypt(account.accountNumberEncrypted),
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
      // Never the storage path itself: more roles can view accounts than manage them.
      hasSignature: Boolean(data.signatureStorageKey),
      signatureUpdatedAt: data.signatureUpdatedAt ?? null,
      isActive: data.isActive,
      createdAt: data.createdAt,
    };
  }
}
