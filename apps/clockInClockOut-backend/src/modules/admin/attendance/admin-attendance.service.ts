import fs from "fs";
import path from "path";
import * as XLSX from "xlsx";
import PDFDocument from "pdfkit";
import { UPLOADS_DIR } from "../../../shared/utils/uploadDir.js";
import { AdminAttendanceRepository } from "./admin-attendance.repository.js";
import type {
  AdminAttendanceQueryInput,
  AdminAttendanceExportInput,
  FormattedAttendanceItem,
  AttendanceSummaryMetrics,
} from "./admin-attendance.schema.js";

export class AdminAttendanceService {
  constructor(private readonly repo: AdminAttendanceRepository) {}

  /**
   * Format a Date into YYYY-MM-DD
   */
  private formatDateOnly(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, "0");
    const day = String(date.getUTCDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  /**
   * Format a Date into HH:mm:ss
   */
  private formatTimeOnly(date: Date | null): string | null {
    if (!date) return null;
    const hours = String(date.getUTCHours()).padStart(2, "0");
    const minutes = String(date.getUTCMinutes()).padStart(2, "0");
    const seconds = String(date.getUTCSeconds()).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
  }

  /**
   * Computes decimal working hours between clock-in and clock-out
   */
  private calculateWorkingHours(
    workingHoursDecimal: any,
    clockInTime: Date,
    clockOutTime: Date | null
  ): number {
    if (workingHoursDecimal !== null && workingHoursDecimal !== undefined) {
      return parseFloat(Number(workingHoursDecimal).toFixed(1));
    }
    if (clockOutTime && clockInTime) {
      const diffMs = clockOutTime.getTime() - clockInTime.getTime();
      if (diffMs > 0) {
        return parseFloat((diffMs / (1000 * 60 * 60)).toFixed(1));
      }
    }
    return 0;
  }

  /**
   * Generates readable audit note if none is stored
   */
  private resolveNotes(notes: string | null, status: string): string {
    if (notes && notes.trim().length > 0) {
      return notes;
    }
    switch (status) {
      case "present":
        return "On-time arrival · Shift verified";
      case "late":
        return "Late check-in recorded";
      case "absent":
        return "Unexcused absence";
      case "half_day":
        return "Half-day shift completed";
      case "auto_closed":
        return "Auto-closed at day-end threshold";
      default:
        return "--";
    }
  }

  /**
   * Fetch paginated attendance records and aggregated report metrics
   */
  async getAttendanceReport(tenantId: string, query: AdminAttendanceQueryInput) {
    const { items, total, allSummaryRecords, page, limit, totalPages } =
      await this.repo.findAttendanceRecords(tenantId, query);

    // Transform DB rows into frontend FormattedAttendanceItem
    const formattedItems: FormattedAttendanceItem[] = items.map((rec) => {
      const statusLower = rec.status.toLowerCase() as FormattedAttendanceItem["status"];
      const hours = this.calculateWorkingHours(rec.workingHours, rec.clockInTime, rec.clockOutTime);

      const isAbsent = statusLower === "absent";
      return {
        id: rec.id,
        date: this.formatDateOnly(rec.clockInDate),
        employeeId: rec.employee.employeeCode,
        employeeName: rec.employee.workspaceMember.user.fullName,
        avatarUrl: rec.employee.biometricPhotoUrl || null,
        checkIn: isAbsent ? null : this.formatTimeOnly(rec.clockInTime),
        checkOut: isAbsent ? null : this.formatTimeOnly(rec.clockOutTime),
        status: statusLower,
        workingHours: isAbsent ? 0 : hours,
        notes: this.resolveNotes(rec.notes, statusLower),
        workspaceId: rec.employee.workspaceMember.workspace.id,
        workspaceName: rec.employee.workspaceMember.workspace.businessName,
      };
    });

    // Compute high-level summary KPIs from all filtered records
    const nonAbsentRecords = allSummaryRecords.filter((r) => r.status !== "ABSENT");
    const totalShifts = nonAbsentRecords.length;
    const lateCount = allSummaryRecords.filter((r) => r.status === "LATE").length;
    const latePercentage = totalShifts > 0 ? Math.round((lateCount / totalShifts) * 100) : 0;

    let totalHoursSum = 0;
    let completedShiftsCount = 0;
    for (const r of allSummaryRecords) {
      if (r.clockOutTime && r.clockInTime) {
        const h = this.calculateWorkingHours(r.workingHours, r.clockInTime, r.clockOutTime);
        if (h > 0) {
          totalHoursSum += h;
          completedShiftsCount++;
        }
      }
    }
    const averageWorkingHours =
      completedShiftsCount > 0
        ? parseFloat((totalHoursSum / completedShiftsCount).toFixed(1))
        : 0;

    const absentCount = allSummaryRecords.filter((r) => r.status === "ABSENT").length;

    const summary: AttendanceSummaryMetrics = {
      totalShifts,
      lateCount,
      latePercentage,
      averageWorkingHours,
      absentCount,
    };

    return {
      items: formattedItems,
      pagination: {
        total,
        page,
        limit,
        totalPages,
      },
      summary,
    };
  }

  /**
   * Fetch quick summary metrics for organization
   */
  async getSummary(tenantId: string, workspaceId?: string) {
    return this.repo.getSummaryMetrics(tenantId, workspaceId);
  }

  /**
   * Generates and writes export report (XLSX, CSV, PDF) and returns the public download URL
   */
  async generateExportReport(
    tenantId: string,
    input: AdminAttendanceExportInput
  ): Promise<{
    downloadUrl: string;
    filename: string;
    format: string;
    totalRecords: number;
  }> {
    const rawRecords = await this.repo.findAllAttendanceRecordsForExport(tenantId, input);

    const formattedItems: FormattedAttendanceItem[] = rawRecords.map((rec) => {
      const statusLower = rec.status.toLowerCase() as FormattedAttendanceItem["status"];
      const hours = this.calculateWorkingHours(rec.workingHours, rec.clockInTime, rec.clockOutTime);

      const isAbsent = statusLower === "absent";
      return {
        id: rec.id,
        date: this.formatDateOnly(rec.clockInDate),
        employeeId: rec.employee.employeeCode,
        employeeName: rec.employee.workspaceMember.user.fullName,
        avatarUrl: rec.employee.biometricPhotoUrl || null,
        checkIn: isAbsent ? null : this.formatTimeOnly(rec.clockInTime),
        checkOut: isAbsent ? null : this.formatTimeOnly(rec.clockOutTime),
        status: statusLower,
        workingHours: isAbsent ? 0 : hours,
        notes: this.resolveNotes(rec.notes, statusLower),
        workspaceId: rec.employee.workspaceMember.workspace.id,
        workspaceName: rec.employee.workspaceMember.workspace.businessName,
      };
    });

    const reportsDir = path.join(UPLOADS_DIR, "reports");
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true });
    }

    const timestamp = Date.now();
    const dateStamp = this.formatDateOnly(new Date());
    const baseName = `attendance_audit_${dateStamp}_${timestamp}`;
    const format = input.format || "xlsx";
    const filename = `${baseName}.${format}`;
    const targetFilePath = path.join(reportsDir, filename);

    if (format === "csv") {
      this.writeCsvFile(formattedItems, targetFilePath);
    } else if (format === "xlsx") {
      this.writeXlsxFile(formattedItems, targetFilePath);
    } else if (format === "pdf") {
      await this.writePdfFile(formattedItems, targetFilePath);
    }

    const downloadUrl = `/api/v1/uploads/reports/${filename}`;

    return {
      downloadUrl,
      filename,
      format,
      totalRecords: formattedItems.length,
    };
  }

  private writeCsvFile(items: FormattedAttendanceItem[], filePath: string): void {
    const headers = [
      "Date",
      "Employee ID",
      "Employee Name",
      "Check In",
      "Check Out",
      "Status",
      "Working Hours",
      "Audit Note",
      "Workspace",
    ];

    const escapeCsv = (val: any) => `"${String(val ?? "").replace(/"/g, '""')}"`;

    const rows = items.map((item) => [
      escapeCsv(item.date),
      escapeCsv(item.employeeId),
      escapeCsv(item.employeeName),
      escapeCsv(item.checkIn || "--"),
      escapeCsv(item.checkOut || (item.checkIn ? "Active Shift" : "--")),
      escapeCsv(item.status.toUpperCase()),
      escapeCsv(item.workingHours ? `${item.workingHours} hrs` : "0.0 hrs"),
      escapeCsv(item.notes || "--"),
      escapeCsv(item.workspaceName || "--"),
    ]);

    const content = "\uFEFF" + [headers.map(escapeCsv).join(","), ...rows.map((r) => r.join(","))].join("\r\n");
    fs.writeFileSync(filePath, content, "utf-8");
  }

  private writeXlsxFile(items: FormattedAttendanceItem[], filePath: string): void {
    const headers = [
      "Date",
      "Employee ID",
      "Employee Name",
      "Check In",
      "Check Out",
      "Status",
      "Working Hours",
      "Audit Note",
      "Workspace",
    ];

    const rows = items.map((item) => [
      item.date,
      item.employeeId,
      item.employeeName,
      item.checkIn || "--",
      item.checkOut || (item.checkIn ? "Active Shift" : "--"),
      item.status.toUpperCase(),
      item.workingHours,
      item.notes || "--",
      item.workspaceName || "--",
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    worksheet["!cols"] = [
      { wch: 12 },
      { wch: 14 },
      { wch: 22 },
      { wch: 12 },
      { wch: 12 },
      { wch: 14 },
      { wch: 14 },
      { wch: 32 },
      { wch: 26 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Attendance Audit");
    XLSX.writeFile(workbook, filePath);
  }

  private writePdfFile(items: FormattedAttendanceItem[], filePath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          layout: "landscape",
          margin: 36,
          size: "A4",
          bufferPages: true,
        });
        const stream = fs.createWriteStream(filePath);

        stream.on("finish", () => resolve());
        stream.on("error", (err) => reject(err));
        doc.pipe(stream);

        // Document Header
        doc.fillColor("#1E293B").fontSize(18).text("SmartBusiness - Attendance Audit Report", 36, 36);
        doc
          .fillColor("#64748B")
          .fontSize(9)
          .text(`Generated on: ${new Date().toUTCString()} | Total Audit Records: ${items.length}`, 36, 60);

        // Divider
        doc.strokeColor("#E2E8F0").lineWidth(1).moveTo(36, 75).lineTo(806, 75).stroke();

        // Table Header
        let y = 88;
        const colX = [36, 105, 185, 305, 375, 445, 525, 595];
        const colWidths = [65, 75, 115, 65, 65, 75, 65, 205];
        const headers = ["Date", "Emp ID", "Employee Name", "Check-In", "Check-Out", "Status", "Hours", "Audit Notes"];

        const drawTableHeader = (posY: number) => {
          doc.rect(36, posY, 770, 20).fill("#F1F5F9");
          doc.fillColor("#0F172A").fontSize(9);
          headers.forEach((h, i) => {
            doc.text(h, colX[i] + 4, posY + 5, { width: colWidths[i] - 8, lineBreak: false });
          });
        };

        drawTableHeader(y);
        y += 22;

        const maxTableY = 530;

        // Rows
        for (let idx = 0; idx < items.length; idx++) {
          const item = items[idx];

          if (y > maxTableY) {
            doc.addPage({ layout: "landscape", margin: 36, size: "A4" });
            y = 36;
            drawTableHeader(y);
            y += 22;
          }

          if (idx % 2 === 1) {
            doc.rect(36, y, 770, 16).fill("#F8FAFC");
          }

          doc.fillColor("#334155").fontSize(8);
          doc.text(item.date, colX[0] + 4, y + 3, { width: colWidths[0] - 8, lineBreak: false });
          doc.text(item.employeeId, colX[1] + 4, y + 3, { width: colWidths[1] - 8, lineBreak: false });
          doc.text(item.employeeName, colX[2] + 4, y + 3, { width: colWidths[2] - 8, lineBreak: false });
          doc.text(item.checkIn || "--", colX[3] + 4, y + 3, { width: colWidths[3] - 8, lineBreak: false });
          doc.text(item.checkOut || (item.checkIn ? "Active" : "--"), colX[4] + 4, y + 3, { width: colWidths[4] - 8, lineBreak: false });
          doc.text(item.status.toUpperCase(), colX[5] + 4, y + 3, { width: colWidths[5] - 8, lineBreak: false });
          doc.text(`${item.workingHours} hrs`, colX[6] + 4, y + 3, { width: colWidths[6] - 8, lineBreak: false });
          doc.text(item.notes || "--", colX[7] + 4, y + 3, { width: colWidths[7] - 8, lineBreak: false });

          y += 16;
        }

        // Draw page footers across all buffered pages safely without triggering page breaks
        const range = doc.bufferedPageRange();
        for (let i = range.start; i < range.start + range.count; i++) {
          doc.switchToPage(i);
          doc.page.margins.bottom = 0;
          doc.fillColor("#94A3B8").fontSize(8).text(
            `SmartBusiness Cloud Attendance Suite · Enterprise Audit Log · Page ${i + 1} of ${range.count}`,
            36,
            doc.page.height - 20,
            { align: "center", width: doc.page.width - 72, lineBreak: false }
          );
        }

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}
