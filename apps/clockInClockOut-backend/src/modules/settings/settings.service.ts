import { prisma } from "@smartbusiness/database";
import type { UpdateSettingsInput } from "./settings.types.js";

export async function svcGetSettings(workspaceId: string) {
    return prisma.attendanceSettings.findUnique({
        where: { workspaceId },
    });
}

export async function svcUpdateSettings(workspaceId: string,  data: UpdateSettingsInput) {
    return prisma.attendanceSettings.update({
        where: { workspaceId },
        data,
    });
}