import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { resolveAccessScope } from "@/src/lib/access-scope";
import { toCsv } from "@/src/lib/csv";
import { hasPermission } from "@/src/lib/rbac";
import { prisma } from "@/src/lib/prisma";

export async function GET() {
  const session = await auth();
  const roles = session?.user?.roleKeys || [];
  if (!session?.user?.id || !hasPermission(roles, "REPORTS", "EXPORT", session?.user?.email)) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const scope = await resolveAccessScope({
    id: session.user.id,
    email: session.user.email,
    roleKeys: session.user.roleKeys || [],
  });
  const reports = await prisma.dailySiteReport.findMany({
    where:
      scope.projectIds === null
        ? {}
        : { projectId: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] } },
    include: { project: true, createdBy: true },
    orderBy: { reportDate: "desc" },
  });
  const data = reports.map((report) => ({
    Data: report.reportDate.toLocaleDateString("ro-RO"),
    Proiect: report.project.title,
    Vreme: report.weather || "-",
    Muncitori: report.workersCount,
    Blocaje: report.blockers || "-",
    SSM: report.safetyIncidents || "-",
    Autor: report.createdBy ? `${report.createdBy.firstName} ${report.createdBy.lastName}` : "-",
  }));

  const csv = toCsv(data);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=rapoarte-zilnice.csv",
    },
  });
}
