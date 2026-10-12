import "dotenv/config";
import { prisma } from "../src/index.js";
// ============================================================================
// DETERMINISTIC IDS
// Must match the IDs in your existing base seed.
// ============================================================================
const IDS = {
    WORKSPACES: {
        GREEN_ACRES: "30000000-0000-0000-0000-000000000001",
        SUNSHINE: "30000000-0000-0000-0000-000000000002",
    },
    USERS: {
        MARIA: "20000000-0000-0000-0000-000000000001",
        JENNIFER: "20000000-0000-0000-0000-000000000002",
        DAVID: "20000000-0000-0000-0000-000000000003",
        SARAH: "20000000-0000-0000-0000-000000000006",
    },
    EMPLOYEES: {
        MARIA: "a0000000-0000-0000-0000-000000000001",
        JENNIFER: "a0000000-0000-0000-0000-000000000002",
        DAVID: "a0000000-0000-0000-0000-000000000003",
        SARAH: "a0000000-0000-0000-0000-000000000004",
    },
    RECORDS: {
        MARIA_TODAY: "b0000000-0000-0000-0000-000000000001",
        JENNIFER_TODAY: "b0000000-0000-0000-0000-000000000002",
        DAVID_YESTERDAY: "b0000000-0000-0000-0000-000000000003",
        MARIA_YESTERDAY: "b0000000-0000-0000-0000-000000000004",
        JENNIFER_TWO_DAYS_AGO: "b0000000-0000-0000-0000-000000000005",
        SARAH_TODAY: "b0000000-0000-0000-0000-000000000006",
    },
    SCHEDULES: {
        MARIA: "c0000000-0000-0000-0000-000000000001",
        JENNIFER: "c0000000-0000-0000-0000-000000000002",
        DAVID: "c0000000-0000-0000-0000-000000000003",
        SARAH: "c0000000-0000-0000-0000-000000000004",
    },
};
// Austin, Texas — Green Acres and Sunshine workspaces.
const LOCATION = {
    latitude: -97.7431,
    longitude: 30.2672,
};
// ============================================================================
// DATE HELPERS
// ============================================================================
function dateAt(daysAgo, hours, minutes = 0) {
    const date = new Date();
    date.setDate(date.getDate() - daysAgo);
    date.setHours(hours, minutes, 0, 0);
    return date;
}
function dateOnly(daysAgo) {
    const date = dateAt(daysAgo, 0);
    return date;
}
// Store the shift times using a fixed reference date.
// AttendanceSchedule uses DateTime for both shiftStartTime and shiftEndTime.
function shiftTime(hours, minutes = 0) {
    const date = new Date("2000-01-01T00:00:00.000Z");
    date.setUTCHours(hours, minutes, 0, 0);
    return date;
}
// ============================================================================
// SEED: ATTENDANCE SETTINGS
// ============================================================================
async function seedAttendanceSettings() {
    console.log("\nSeeding attendance settings...");
    const settings = [
        IDS.WORKSPACES.GREEN_ACRES,
        IDS.WORKSPACES.SUNSHINE,
    ];
    for (const workspaceId of settings) {
        await prisma.attendanceSettings.upsert({
            where: { workspaceId },
            update: {},
            create: {
                workspaceId,
                latitude: LOCATION.latitude,
                longitude: LOCATION.longitude,
                radiusMeters: 100,
                graceMinutes: 15,
            },
        });
    }
    console.log(`  Created/verified ${settings.length} settings records.`);
}
// ============================================================================
// SEED: EMPLOYEE PROFILES
// ============================================================================
async function seedEmployees() {
    console.log("\nSeeding employee profiles...");
    const employees = [
        {
            id: IDS.EMPLOYEES.MARIA,
            workspaceId: IDS.WORKSPACES.GREEN_ACRES,
            userId: IDS.USERS.MARIA,
            employeeCode: "EMP-001",
            designation: "Operations Manager",
            department: "Operations",
            biometricPhotoUrl: "https://example.com/biometrics/maria.jpg",
        },
        {
            id: IDS.EMPLOYEES.JENNIFER,
            workspaceId: IDS.WORKSPACES.GREEN_ACRES,
            userId: IDS.USERS.JENNIFER,
            employeeCode: "EMP-002",
            designation: "Office Administrator",
            department: "Administration",
            biometricPhotoUrl: "https://example.com/biometrics/jennifer.jpg",
        },
        {
            id: IDS.EMPLOYEES.DAVID,
            workspaceId: IDS.WORKSPACES.GREEN_ACRES,
            userId: IDS.USERS.DAVID,
            employeeCode: "EMP-003",
            designation: "Field Supervisor",
            department: "Field Operations",
            biometricPhotoUrl: "https://example.com/biometrics/david.jpg",
        },
        {
            id: IDS.EMPLOYEES.SARAH,
            workspaceId: IDS.WORKSPACES.SUNSHINE,
            userId: IDS.USERS.SARAH,
            employeeCode: "EMP-101",
            designation: "Service Manager",
            department: "Pool Maintenance",
            biometricPhotoUrl: "https://example.com/biometrics/sarah.jpg",
        },
    ];
    for (const employee of employees) {
        // Resolve the existing WorkspaceMember instead of creating a new one.
        const member = await prisma.workspaceMember.findUnique({
            where: {
                workspaceId_userId: {
                    workspaceId: employee.workspaceId,
                    userId: employee.userId,
                },
            },
        });
        if (!member) {
            throw new Error(`WorkspaceMember not found for employee ${employee.employeeCode}. ` +
                "Run the base seed first.");
        }
        await prisma.attendanceEmployeeDetails.upsert({
            where: {
                workspaceMemberId: member.id,
            },
            update: {
                employeeCode: employee.employeeCode,
                designation: employee.designation,
                department: employee.department,
                biometricPhotoUrl: employee.biometricPhotoUrl,
                isActive: true,
            },
            create: {
                id: employee.id,
                workspaceMemberId: member.id,
                employeeCode: employee.employeeCode,
                designation: employee.designation,
                department: employee.department,
                biometricPhotoUrl: employee.biometricPhotoUrl,
                isActive: true,
            },
        });
    }
    console.log(`  Created/verified ${employees.length} employees.`);
}
// ============================================================================
// SEED: ATTENDANCE RECORDS
// ============================================================================
async function seedAttendanceRecords() {
    console.log("\nSeeding attendance records...");
    const records = [
        {
            id: IDS.RECORDS.MARIA_TODAY,
            employeeId: IDS.EMPLOYEES.MARIA,
            daysAgo: 0,
            status: "PRESENT",
            clockIn: [8, 55],
            clockOut: [17, 5],
            confidenceIn: 98.5,
            confidenceOut: 99.1,
        },
        {
            id: IDS.RECORDS.JENNIFER_TODAY,
            employeeId: IDS.EMPLOYEES.JENNIFER,
            daysAgo: 0,
            status: "LATE",
            clockIn: [9, 25],
            clockOut: [17, 10],
            confidenceIn: 97.2,
            confidenceOut: 98.4,
        },
        {
            id: IDS.RECORDS.DAVID_YESTERDAY,
            employeeId: IDS.EMPLOYEES.DAVID,
            daysAgo: 1,
            status: "HALF_DAY",
            clockIn: [9, 0],
            clockOut: [13, 0],
            confidenceIn: 96.8,
            confidenceOut: 97.5,
        },
        {
            id: IDS.RECORDS.MARIA_YESTERDAY,
            employeeId: IDS.EMPLOYEES.MARIA,
            daysAgo: 1,
            status: "AUTO_CLOSED",
            clockIn: [8, 50],
            clockOut: [17, 0],
            confidenceIn: 98.1,
            confidenceOut: 0,
        },
        {
            id: IDS.RECORDS.JENNIFER_TWO_DAYS_AGO,
            employeeId: IDS.EMPLOYEES.JENNIFER,
            daysAgo: 2,
            status: "ABSENT",
            clockIn: [0, 0],
            clockOut: [0, 0],
            confidenceIn: 0,
            confidenceOut: 0,
        },
        {
            id: IDS.RECORDS.SARAH_TODAY,
            employeeId: IDS.EMPLOYEES.SARAH,
            daysAgo: 0,
            status: "PRESENT",
            clockIn: [8, 45],
            clockOut: [17, 0],
            confidenceIn: 99.0,
            confidenceOut: 98.8,
        },
    ];
    for (const record of records) {
        const clockInTime = dateAt(record.daysAgo, record.clockIn[0], record.clockIn[1]);
        const clockOutTime = dateAt(record.daysAgo, record.clockOut[0], record.clockOut[1]);
        // ABSENT records intentionally have no actual clock-in/out event.
        const isAbsent = record.status === "ABSENT";
        await prisma.attendanceRecord.upsert({
            where: {
                id: record.id,
            },
            update: {
                status: record.status,
                clockInDate: dateOnly(record.daysAgo),
                clockInTime,
                clockOutDate: dateOnly(record.daysAgo),
                clockOutTime,
                clockInLatitude: LOCATION.latitude,
                clockInLongitude: LOCATION.longitude,
                clockOutLatitude: LOCATION.latitude,
                clockOutLongitude: LOCATION.longitude,
                clockInFaceMatchConfidence: record.confidenceIn,
                clockOutFaceMatchConfidence: record.confidenceOut,
            },
            create: {
                id: record.id,
                employeeId: record.employeeId,
                status: record.status,
                clockInDate: dateOnly(record.daysAgo),
                clockInTime,
                clockInLatitude: LOCATION.latitude,
                clockInLongitude: LOCATION.longitude,
                clockInFaceMatchConfidence: record.confidenceIn,
                clockOutDate: dateOnly(record.daysAgo),
                clockOutTime,
                clockOutLatitude: LOCATION.latitude,
                clockOutLongitude: LOCATION.longitude,
                clockOutFaceMatchConfidence: record.confidenceOut,
                selfieUrl: isAbsent
                    ? null
                    : `https://example.com/attendance/${record.employeeId}/${record.daysAgo}.jpg`,
            },
        });
    }
    console.log(`  Created/verified ${records.length} attendance records.`);
}
// ============================================================================
// SEED: EMPLOYEE SCHEDULES
// ============================================================================
async function seedAttendanceSchedules() {
    console.log("\nSeeding employee schedules...");
    const schedules = [
        {
            id: IDS.SCHEDULES.MARIA,
            employeeId: IDS.EMPLOYEES.MARIA,
            shiftStartDay: "MON",
            shiftStartTime: shiftTime(9, 0),
            shiftEndDay: "MON",
            shiftEndTime: "FRI",
        },
        {
            id: IDS.SCHEDULES.JENNIFER,
            employeeId: IDS.EMPLOYEES.JENNIFER,
            shiftStartDay: "MON",
            shiftStartTime: shiftTime(9, 0),
            shiftEndDay: "MON",
            shiftEndTime: "FRI",
        },
        {
            id: IDS.SCHEDULES.DAVID,
            employeeId: IDS.EMPLOYEES.DAVID,
            shiftStartDay: "MON",
            shiftStartTime: shiftTime(8, 0),
            shiftEndDay: "MON",
            shiftEndTime: "FRI",
        },
        {
            id: IDS.SCHEDULES.SARAH,
            employeeId: IDS.EMPLOYEES.SARAH,
            shiftStartDay: "MON",
            shiftStartTime: shiftTime(8, 30),
            shiftEndDay: "MON",
            shiftEndTime: "FRI",
        },
    ];
    for (const schedule of schedules) {
        await prisma.attendanceSchedule.upsert({
            where: {
                id: schedule.id,
            },
            update: {
                shiftStartDay: schedule.shiftStartDay,
                shiftStartTime: schedule.shiftStartTime,
                shiftEndDay: schedule.shiftEndDay,
                shiftEndTime: schedule.shiftEndTime,
            },
            create: schedule,
        });
    }
    console.log(`  Created/verified ${schedules.length} schedules.`);
}
// ============================================================================
// MAIN
// ============================================================================
async function main() {
    console.log("========================================");
    console.log(" SmartBusiness — Attendance Seed");
    console.log("========================================");
    await seedAttendanceSettings();
    await seedEmployees();
    await seedAttendanceRecords();
    await seedAttendanceSchedules();
    console.log("\nAttendance seed summary:");
    console.log("  Settings:", await prisma.attendanceSettings.count());
    console.log("  Employees:", await prisma.attendanceEmployeeDetails.count());
    console.log("  Attendance records:", await prisma.attendanceRecord.count());
    console.log("  Schedules:", await prisma.attendanceSchedule.count());
    console.log("\nAttendance seeding complete.");
}
main()
    .catch((error) => {
    console.error("Attendance seeding failed:", error);
    process.exitCode = 1;
})
    .finally(async () => {
    await prisma.$disconnect();
});
