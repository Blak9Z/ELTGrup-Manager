import Link from "next/link";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { PageHeader } from "@/src/components/ui/page-header";
import { formatDate } from "@/src/lib/utils";
import { prisma } from "@/src/lib/prisma";
import { DailyReportCreateForm } from "./daily-report-create-form";

export default async function RapoarteZilnicePage() {
  const [projects, workOrders, reports] = await Promise.all([
    prisma.project.findMany({ where: { deletedAt: null }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
    prisma.workOrder.findMany({ where: { deletedAt: null }, select: { id: true, title: true }, orderBy: { title: "asc" }, take: 150 }),
    prisma.dailySiteReport.findMany({
      include: { project: true, workOrder: true, createdBy: true },
      orderBy: { reportDate: "desc" },
      take: 60,
    }),
  ]);

  return (
    <PermissionGuard resource="REPORTS" action="VIEW">
      <div className="space-y-6">
        <PageHeader title="Rapoarte zilnice de santier" subtitle="Vreme, prezenta, progres lucrari, blocaje, SSM, poze si semnaturi" />
        <div className="flex justify-end">
          <Link href="/api/export/rapoarte">
            <Button variant="secondary">Export Excel Rapoarte</Button>
          </Link>
        </div>

        <Card>
          <h2 className="text-lg font-extrabold">Raport nou</h2>
          <DailyReportCreateForm
            projects={projects.map((project) => ({ id: project.id, label: project.title }))}
            workOrders={workOrders.map((workOrder) => ({ id: workOrder.id, label: workOrder.title }))}
          />
        </Card>

        <div className="space-y-3">
          {reports.map((report) => (
            <Card key={report.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-bold">{report.project.title}</p>
                  <p className="text-xs text-[#5d7064]">Data: {formatDate(report.reportDate)} • Vreme: {report.weather || "-"}</p>
                  <p className="mt-2 text-sm text-[#304638]">{report.workCompleted}</p>
                  <p className="mt-1 text-xs text-[#607367]">Blocaje: {report.blockers || "N/A"}</p>
                  <p className="mt-1 text-xs text-[#607367]">Creat de: {report.createdBy ? `${report.createdBy.firstName} ${report.createdBy.lastName}` : "-"}</p>
                </div>
                <Link href={`/api/rapoarte-zilnice/${report.id}/pdf`}>
                  <Button size="sm" variant="secondary">Export PDF</Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PermissionGuard>
  );
}
