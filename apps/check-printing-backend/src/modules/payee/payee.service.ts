import { ConflictError } from "../../shared/errors/conflict-error.js";
import { NotFoundError } from "../../shared/errors/not-found-error.js";
import { ValidationError } from "../../shared/errors/validation-error.js";
import { PayeeRepository } from "./payee.repository.js";
import { CreatePayeeInput, ListPayeesQuery, UpdatePayeeInput } from "./payee.schema.js";


export class PayeeService {

    private payeeRepository: PayeeRepository

    constructor(payeeRepository: PayeeRepository) {
        this.payeeRepository = payeeRepository;
    }

    async createPayee(workspaceId: string, data: CreatePayeeInput) {

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
        })

        return this.formatPayee(payee);

    }

    async getPayee(payeeId: string, workspaceId: string) {
        const payee = await this.payeeRepository.findById(payeeId);

        if (!payee || payee.workspaceId !== workspaceId) {
            throw new NotFoundError("Payee");
        }

        return this.formatPayee(payee);
    }

    async listPayess(workspaceId: string, query: ListPayeesQuery) {
        const { items, total } = await this.payeeRepository.list({
            workspaceId: workspaceId,
            search: query.search,
            activeOnly: query.activeOnly,
            limit: query.limit,
            offset: query.offset
        })

        return {
            items: items.map((p) => this.formatPayee(p)),
            meta: {
                total: total,
                limit: query.limit,
                offset: query.offset,
                hasMore: query.offset + query.limit < total
            }
        }
    }

    async updatePayee(payeeId: string, workspaceId: string, data: UpdatePayeeInput) {

        const existing = await this.payeeRepository.findById(payeeId);

        if (!existing || existing.workspaceId !== workspaceId) {
            throw new NotFoundError("Payee")
        }

        // if name is changing , then check for duplicate name 

        if (data.name && data.name !== existing.name) {
            const duplicate = await this.payeeRepository.findByWorkspaceAndName(workspaceId, data.name);

            if (duplicate) {
                throw new ConflictError(`A payee named "${data.name}" already exists in this workspace`)
            }
        }

        const updated = await this.payeeRepository.update(payeeId, {
            ...(data.name && { name: data.name }),
            ...(data.defaultMemo !== undefined && { defaultMemo: data.defaultMemo || null }),
            ...(data.addressLine1 !== undefined && { addressLine1: data.addressLine1 || null }),
            ...(data.addressLine2 !== undefined && { addressLine2: data.addressLine2 || null }),
            ...(data.city !== undefined && { city: data.city || null }),
            ...(data.state !== undefined && { state: data.state || null }),
            ...(data.zipCode !== undefined && { zipCode: data.zipCode || null }),
        })

        return this.formatPayee(updated)
    }

    async archivePayee(payeeId: string, workspaceId: string) {
        const existing = await this.payeeRepository.findById(payeeId);

        if (!existing || existing.workspaceId !== workspaceId) {
            throw new NotFoundError("Payee");
        }

        if (!existing.isActive) {
            throw new ValidationError("Payee is already archived");
        }

        const updated = await this.payeeRepository.update(payeeId, { isActive: false });
        return this.formatPayee(updated);
    }

    async restorePayee(payeeId: string, workspaceId: string) {
        const existing = await this.payeeRepository.findById(payeeId);

        if (!existing || existing.workspaceId !== workspaceId) {
            throw new NotFoundError("Payee");
        }

        if (existing.isActive) {
            throw new ValidationError("Payee is already active");
        }

        const updated = await this.payeeRepository.update(payeeId, { isActive: true });
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