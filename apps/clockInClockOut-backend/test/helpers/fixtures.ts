import { TokenService } from "@smartbusiness/auth";
import { TEST_JWT_SECRET } from "../setup/test-env.js";

const tokenService = new TokenService(TEST_JWT_SECRET, "15m");

export interface TestUser {
  id: string;
  email: string;
  tenantId: string;
  role?: string;
}

export interface TestWorld {
  tenantId: string;
  workspaceId: string;
  admin: TestUser;
  employee: TestUser;
}

export function createTestWorld(): TestWorld {
  const tenantId = "ten_test_" + Math.random().toString(36).substring(2, 9);
  const workspaceId = "ws_test_" + Math.random().toString(36).substring(2, 9);

  return {
    tenantId,
    workspaceId,
    admin: {
      id: "usr_admin_" + Math.random().toString(36).substring(2, 9),
      email: "admin@test.local",
      tenantId,
      role: "admin",
    },
    employee: {
      id: "usr_emp_" + Math.random().toString(36).substring(2, 9),
      email: "employee@test.local",
      tenantId,
      role: "employee",
    },
  };
}

/** Request headers that authenticate as `user` in its tenant */
export function authHeaders(
  user: TestUser,
  workspaceId?: string
): Record<string, string> {
  const token = tokenService.generateAccessToken({
    userId: user.id,
    email: user.email,
  });

  const headers: Record<string, string> = {
    Cookie: `access_token=${token}`,
    "X-Tenant-Id": user.tenantId,
  };

  if (workspaceId) {
    headers["X-Workspace-Id"] = workspaceId;
  }

  return headers;
}
