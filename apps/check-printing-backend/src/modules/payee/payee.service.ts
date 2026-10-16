import { ConflictError } from "../../shared/errors/conflict-error.js";
import { NotFoundError } from "../../shared/errors/not-found-error.js";
import { ValidationError } from "../../shared/errors/validation-error.js";
import { AuditService } from "../../shared/services/audit.service.js";
import { PayeeRepository } from "./payee.repository.js";
import { CreatePayeeInput, ListPayeesQuery, UpdatePayeeInput } from "./payee.schema.js";

// Optional fields a payee update may change or clear (an empty string clears one). The name
// is handled on its own: it can change but never be cleared.
const CLEARABLE_FIELDS = ["defaultMemo", "addressLine1", "addressLine2", "city", "state", "zipCode"] as const;
type ClearableField = (typeof CLEARABLE_FIELDS)[number];

interface AuditContext {
    userId: string;
    tenantId: string;
    ipAddress?: string;
}

export class PayeeService {

    private payeeRepository: PayeeRepository;
    private auditService: AuditService;

    constructor(payeeRepository: PayeeRepository, auditService: AuditService) {
        this.payeeRepository = payeeRepository;
        this.auditService = auditService;
    }

    async createPayee(workspaceId: string, data: CreatePayeeInput, ctx: AuditContext) {

        // check for the duplicate name within the workspace

        const existing = await this.payeeRepository.findByWorkspaceAndName(workspaceId, data.name);

        if (existing) {
            throw new ConflictError(`A payee named "${data.name}" already exists in this workspace`);
        }

        const payee = await this.payeeRepository.create({
            workspaceId: workspaceId,
            name: data.name,
            defaultMemo: data.defaultMemo || null,
            addressLine1: data.addressLine1 || null,
            addressLine2: data.addressLine2 || null,
            city: data.city || null,
            state: data.state || null,
            zipCode: data.zipCode || null,
        });

        await this.auditService.log({
            tenantId: ctx.tenantId,
            userId: ctx.userId,
            workspaceId,
            action: "PAYEE_CREATED",
            entityType: "Payee",
            entityId: payee.id,
            details: { name: payee.name },
            ipAddress: ctx.ipAddress,
        });

        return this.formatPayee(payee);

    }

    async getPayee(payeeId: string, workspaceId: string) {
        const payee = await this.payeeRepository.findById(payeeId);

        if (!payee || payee.workspaceId !== workspaceId) {
            throw new NotFoundError("Payee");
        }

        return this.formatPayee(payee);
    }

    async listPayees(workspaceId: string, query: ListPayeesQuery) {
        const { items, total } = await this.payeeRepository.list({
            workspaceId: workspaceId,
            search: query.search,
            activeOnly: query.activeOnly,
            limit: query.limit,
            offset: query.offset
        });

        return {
            items: items.map((p) => this.formatPayee(p)),
            meta: {
                total: total,
                limit: query.limit,
                offset: query.offset,
                hasMore: query.offset + query.limit < total
            }
        };
    }

    async updatePayee(payeeId: string, workspaceId: string, data: UpdatePayeeInput, ctx: AuditContext) {

        const existing = await this.payeeRepository.findById(payeeId);

        if (!existing || existing.workspaceId !== workspaceId) {
            throw new NotFoundError("Payee");
        }

        // if name is changing , then check for duplicate name 

        if (data.name && data.name !== existing.name) {
            const duplicate = await this.payeeRepository.findByWorkspaceAndName(workspaceId, data.name);

            if (duplicate) {
                throw new ConflictError(`A payee named "${data.name}" already exists in this workspace`);
            }
        }

        // Only fields whose value actually changes are written and audited, with the old and
        // new value: "the address changed from 100 Main St to PO Box 666" is what an investigator
        // of a vendor change needs, not just "addressLine1 was edited". An empty string clears a field.
        const changes: { name?: string } & Partial<Record<ClearableField, string | null>> = {};
        const audited: Record<string, { from: string | null; to: string | null }> = {};
        if (data.name !== undefined && data.name !== existing.name) {
            changes.name = data.name;
            audited.name = { from: existing.name, to: data.name };
        }
        for (const field of CLEARABLE_FIELDS) {
            const sent = data[field];
            if (sent === undefined) continue;
            const to = sent || null;
            const from = existing[field] ?? null;
            if (from === to) continue;
            changes[field] = to;
            audited[field] = { from, to };
        }

        if (Object.keys(changes).length === 0) return this.formatPayee(existing);

        const updated = await this.payeeRepository.update(payeeId, { workspaceId, ...changes });

        await this.auditService.log({
            tenantId: ctx.tenantId,
            userId: ctx.userId,
            workspaceId,
            action: "PAYEE_UPDATED",
            entityType: "Payee",
            entityId: payeeId,
            details: { name: existing.name, changes: audited },
            ipAddress: ctx.ipAddress,
        });

        return this.formatPayee(updated);
    }

    async archivePayee(payeeId: string, workspaceId: string, ctx: AuditContext) {
        const existing = await this.payeeRepository.findById(payeeId);

        if (!existing || existing.workspaceId !== workspaceId) {
            throw new NotFoundError("Payee");
        }

        if (!existing.isActive) {
            throw new ValidationError("Payee is already archived");
        }

        const updated = await this.payeeRepository.update(payeeId, { isActive: false });

        await this.auditService.log({
            tenantId: ctx.tenantId,
            userId: ctx.userId,
            workspaceId,
            action: "PAYEE_ARCHIVED",
            entityType: "Payee",
            entityId: payeeId,
            details: { name: existing.name },
            ipAddress: ctx.ipAddress,
        });

        return this.formatPayee(updated);
    }

    async restorePayee(payeeId: string, workspaceId: string, ctx: AuditContext) {
        const existing = await this.payeeRepository.findById(payeeId);

        if (!existing || existing.workspaceId !== workspaceId) {
            throw new NotFoundError("Payee");
        }

        if (existing.isActive) {
            throw new ValidationError("Payee is already active");
        }

        const updated = await this.payeeRepository.update(payeeId, { isActive: true });

        await this.auditService.log({
            tenantId: ctx.tenantId,
            userId: ctx.userId,
            workspaceId,
            action: "PAYEE_RESTORED",
            entityType: "Payee",
            entityId: payeeId,
            details: { name: existing.name },
            ipAddress: ctx.ipAddress,
        });

        return this.formatPayee(updated);
    }


    // ─── Private Helpers ──────────────────────────────────
    private formatPayee(payee: any) {
        return {
            id: payee.id,
            name: payee.name,
            defaultMemo: payee.defaultMemo,
            addressLine1: payee.addressLine1,
            addressLine2: payee.addressLine2,
            city: payee.city,
            state: payee.state,
            zipCode: payee.zipCode,
            isActive: payee.isActive,
            createdAt: payee.createdAt,
            updatedAt: payee.updatedAt,
        };
    }

}