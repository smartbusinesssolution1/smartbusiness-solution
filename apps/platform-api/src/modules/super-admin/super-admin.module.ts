import { PasswordService } from "@smartbusiness/auth";
import { SuperAdminRepository } from "./super-admin.repository.js";
import { SuperAdminService } from "./super-admin.service.js";
import { SuperAdminController } from "./super-admin.controller.js";

const repository = new SuperAdminRepository();
const passwordService = new PasswordService();

export const superAdminService = new SuperAdminService(repository, passwordService);
export const superAdminController = new SuperAdminController(superAdminService);
