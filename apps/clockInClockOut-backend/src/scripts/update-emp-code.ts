import "dotenv/config";
import path from "node:path";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(process.cwd(), "../../packages/database/.env") });
dotenv.config({ path: path.resolve(process.cwd(), "packages/database/.env") });

import { prisma } from "@smartbusiness/database";

async function main() {
  const result = await prisma.attendanceEmployeeDetails.updateMany({
    where: { employeeCode: "EMP-004" },
    data: { employeeCode: "EMP-GA004" },
  });
  console.log("Updated rows:", result.count);
}

main().finally(() => prisma.$disconnect());
