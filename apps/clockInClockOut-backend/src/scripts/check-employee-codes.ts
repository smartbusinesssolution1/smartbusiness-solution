import "dotenv/config";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), "../../packages/database/.env") });
dotenv.config({ path: path.resolve(process.cwd(), "packages/database/.env") });

import { prisma } from "@smartbusiness/database";

async function main() {
  const emp = await prisma.attendanceEmployeeDetails.findFirst({
    where: { employeeCode: "EMP-004" },
    include: {
      workspaceMember: {
        include: { user: true },
      },
    },
  });
  console.log("EMP-004 details:", emp?.id, emp?.workspaceMember?.user?.fullName, emp?.workspaceMember?.user?.email);
}

main().finally(() => prisma.$disconnect());
