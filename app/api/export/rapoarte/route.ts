import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/src/lib/auth";
import { hasPermission } from "@/src/lib/rbac";
import { prisma } from "@/src/lib/prisma";

export async function GET() {
  const session = await auth();
  const roles = session?.user?.roleKeys || [];
  if (!session?.user?.id || !hasPermission(roles, "REPORTS", "EXPORT")) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const reports = await prisma.dailySiteReport.findMany({ include: { project: true, createdBy: true }, orderBy: { reportDate: "desc" } });
  const data = reports.map((report) => ({
    Data: report.reportDate.toLocaleDateString("ro-RO"),
    Proiect: report.project.title,
    Vreme: report.weather || "-",
    Muncitori: report.workersCount,
    Blocaje: report.blockers || "-",
    SSM: report.safetyIncidents || "-",
    Autor: report.createdBy ? `${report.createdBy.firstName} ${report.createdBy.lastName}` : "-",
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Rapoarte");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=rapoarte-zilnice.xlsx",
    },
  });
}
