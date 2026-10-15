import "dotenv/config";
import path from "node:path";
import dotenv from "dotenv";

// Also load packages/database/.env if DATABASE_URL is not set
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), "../../packages/database/.env") });
  dotenv.config({ path: path.resolve(process.cwd(), "packages/database/.env") });
  dotenv.config({ path: path.resolve(__dirname, "../../../../packages/database/.env") });
}

import { prisma, Prisma } from "@smartbusiness/database";

const DAYS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"] as const;

async function run() {
  console.log("Checking employees in Neon DB...");
  const employees = await prisma.attendanceEmployeeDetails.findMany({
    select: {
      id: true,
      employeeCode: true,
      shiftType: true,
      weeklySchedule: true,
    },
  });

  console.log(`Found ${employees.length} employees in DB.`);

  for (const emp of employees) {
    const raw = emp.weeklySchedule;
    console.log(`\nEmployee: ${emp.employeeCode} (${emp.id}) | shiftType: ${emp.shiftType}`);
    console.log("Current weeklySchedule isArray?", Array.isArray(raw));

    if (Array.isArray(raw) && raw.length === 7 && (raw[0] as any).day) {
      console.log("-> Already valid 7-day array:", JSON.stringify(raw));
      continue;
    }

    // Convert to 7-day array
    let newArray: any[] = [];
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      console.log("Converting legacy object format to array...");
      const map = raw as Record<string, any>;
      newArray = DAYS.map((d) => ({
        day: d,
        isWorkDay: map[d]?.isWorkDay ?? !["SAT", "SUN"].includes(d),
        startTime: map[d]?.startTime || "09:00",
        endTime: map[d]?.endTime || "18:00",
      }));
    } else {
      console.log("Populating default general 7-day array for null/empty schedule...");
      newArray = DAYS.map((d) => ({
        day: d,
        isWorkDay: !["SAT", "SUN"].includes(d),
        startTime: "09:00",
        endTime: "18:00",
      }));
    }

    await prisma.attendanceEmployeeDetails.update({
      where: { id: emp.id },
      data: {
        weeklySchedule: newArray as unknown as Prisma.InputJsonValue,
      },
    });

    console.log("-> Successfully migrated to array in Neon DB!");
    console.log(JSON.stringify(newArray, null, 2));
  }

  console.log("\nMigration completed successfully!");
}

run()
  .catch((e) => {
    console.error("Migration failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
