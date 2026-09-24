import { Prisma, prisma } from "@smartbusiness/database";

interface createPayeeData {
  workspaceId: string;
  name: string;
  defaultMemo?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
}
interface ListPayeesParams {
  workspaceId: string;
  search?: string;
  activeOnly: boolean;
  limit: number;
  offset: number;
}
export class PayeeRepository {
  async create(data: createPayeeData) {
    return prisma.payee.create({ data });
  }

  async findById(id: string) {
    return prisma.payee.findFirst({
      where: {
        id: id,
        deletedAt: null,
      },
    });
  }

  async findByWorkspaceAndName(workspaceId: string, name: string) {
    return prisma.payee.findFirst({
      where: {
        workspaceId: workspaceId,
        name: name,
        deletedAt: null,
      },
    });
  }

  async list(params: ListPayeesParams) {
    const where: Prisma.PayeeWhereInput = {
      workspaceId: params.workspaceId,
      deletedAt: null,
    };

    if (params.activeOnly) {
      where.isActive = true;
    }

    if (params.search) {
      where.name = { contains: params.search, mode: "insensitive" };
    }

    const [items, total] = await Promise.all([
      prisma.payee.findMany({
        where,
        take: params.limit,
        skip: params.offset,
        orderBy: { name: "asc" },
      }),

      prisma.payee.count({ where }),
    ]);

    return { items, total };
  }

  async update(
    id: string,
    data: Partial<createPayeeData> & { isActive?: boolean },
  ) {
    return prisma.payee.update({
      where: {
        id: id,
        workspaceId: data.workspaceId,
        deletedAt: null,
      },
      data,
    });
  }
}
