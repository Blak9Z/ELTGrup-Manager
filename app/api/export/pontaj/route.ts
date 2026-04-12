import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/src/lib/auth";
import { hasPermission } from "@/src/lib/rbac";
import { prisma } from "@/src/lib/prisma";

export async function GET(request: Request) {
  const session = await auth();
  const roles = session?.user?.roleKeys || [];

  if (!session?.user?.id || !hasPermission(roles, "TIME_TRACKING", "EXPORT")) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const url = new URL(request.url);
  const month = Number(url.searchParams.get("month") || new Date().getMonth() + 1);
  const year = Number(url.searchParams.get("year") || new Date().getFullYear());

  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 0, 23, 59, 59);

  const rows = await prisma.timeEntry.findMany({
    where: { startAt: { gte: from, lte: to } },
    include: { user: true, project: true, workOrder: true },
    orderBy: { startAt: "asc" },
  });

  const data = rows.map((entry) => ({
    Data: new Date(entry.startAt).toLocaleDateString("ro-RO"),
    Angajat: `${entry.user.firstName} ${entry.user.lastName}`,
    Proiect: entry.project.title,
    Lucrare: entry.workOrder?.title || "-",
    DurataOre: (entry.durationMinutes / 60).toFixed(2),
    PauzaMinute: entry.breakMinutes,
    OvertimeMinute: entry.overtimeMinutes,
    Status: entry.status,
  }));

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Pontaj");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const body = new Uint8Array(buffer);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename=pontaj-${year}-${String(month).padStart(2, "0")}.xlsx`,
    },
  });
}
