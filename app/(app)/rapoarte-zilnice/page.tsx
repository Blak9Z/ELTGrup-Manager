import Link from "next/link";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { PageHeader } from "@/src/components/ui/page-header";
import { auth } from "@/src/lib/auth";
import { resolveAccessScope } from "@/src/lib/access-scope";
import { formatDate } from "@/src/lib/utils";
import { prisma } from "@/src/lib/prisma";
import { DailyReportCreateForm } from "./daily-report-create-form";

export default async function RapoarteZilnicePage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; workOrderId?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page || "1"));
  const pageSize = 20;
  const session = await auth();
  const scope = session?.user
    ? await resolveAccessScope({
        id: session.user.id,
        email: session.user.email,
        roleKeys: session.user.roleKeys || [],
      })
    : { projectIds: null, teamId: null };
  const scopedProjectFilter = scope.projectIds === null ? null : { in: scope.projectIds.length ? scope.projectIds : ["__none__"] };

  const scopedProjectIds = scope.projectIds === null ? null : scope.projectIds.length ? scope.projectIds : ["__none__"];
  const selectedProjectId =
    params.projectId && (scope.projectIds === null || scope.projectIds.includes(params.projectId)) ? params.projectId : undefined;
  const workOrdersWhere =
    selectedProjectId
      ? { deletedAt: null, projectId: selectedProjectId }
      : { deletedAt: null, ...(scope.projectIds === null ? {} : { projectId: scopedProjectFilter! }) };
  const reportsWhere =
    selectedProjectId
      ? { projectId: selectedProjectId, workOrderId: params.workOrderId || undefined }
      : {
          ...(scope.projectIds === null ? {} : { projectId: { in: scopedProjectIds! } }),
          workOrderId: params.workOrderId || undefined,
        };

  const [projects, workOrders, reports, totalReports] = await Promise.all([
    prisma.project.findMany({
      where: { deletedAt: null, ...(scope.projectIds === null ? {} : { id: scopedProjectFilter! }) },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    prisma.workOrder.findMany({
      where: workOrdersWhere,
      select: { id: true, title: true },
      orderBy: { title: "asc" },
      take: 100,
    }),
    prisma.dailySiteReport.findMany({
      where: reportsWhere,
      select: {
        id: true,
        reportDate: true,
        weather: true,
        workCompleted: true,
        blockers: true,
        workersCount: true,
        createdBy: { select: { firstName: true, lastName: true } },
        project: { select: { title: true } },
        workOrder: { select: { title: true } },
      },
      orderBy: { reportDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.dailySiteReport.count({ where: reportsWhere }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalReports / pageSize));
  const blockersCount = reports.filter((item) => Boolean(item.blockers)).length;
  const totalWorkers = reports.reduce((sum, item) => sum + item.workersCount, 0);

  return (
    <PermissionGuard resource="REPORTS" action="VIEW">
      <div className="space-y-6">
        <PageHeader title="Rapoarte zilnice de santier" subtitle="Vreme, prezenta, progres lucrari, blocaje, SSM, poze si semnaturi" />
        <Card>
          <form className="grid gap-3 md:grid-cols-3">
            <input type="hidden" name="page" value="1" />
            <select name="projectId" defaultValue={selectedProjectId || ""} className="h-10 rounded-lg border border-[var(--border)] px-3 text-sm">
              <option value="">Toate proiectele</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
            <select name="workOrderId" defaultValue={params.workOrderId || ""} className="h-10 rounded-lg border border-[var(--border)] px-3 text-sm">
              <option value="">Toate lucrarile</option>
              {workOrders.map((workOrder) => (
                <option key={workOrder.id} value={workOrder.id}>
                  {workOrder.title}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary">Filtreaza</Button>
          </form>
        </Card>
        <div className="flex justify-end">
          <Link href="/api/export/rapoarte">
            <Button variant="secondary">Export CSV Rapoarte</Button>
          </Link>
        </div>

        <section className="grid gap-3 md:grid-cols-3">
          <Card>
            <p className="text-xs text-[#9fb2ce]">Rapoarte recente</p>
            <p className="mt-2 text-2xl font-semibold">{reports.length}</p>
          </Card>
          <Card>
            <p className="text-xs text-[#9fb2ce]">Rapoarte cu blocaje</p>
            <p className="mt-2 text-2xl font-semibold">{blockersCount}</p>
          </Card>
          <Card>
            <p className="text-xs text-[#9fb2ce]">Total muncitori raportati</p>
            <p className="mt-2 text-2xl font-semibold">{totalWorkers}</p>
          </Card>
        </section>

        <Card>
          <h2 className="text-lg font-extrabold">Raport nou</h2>
          <DailyReportCreateForm
            projects={projects.map((project) => ({ id: project.id, label: project.title }))}
            workOrders={workOrders.map((workOrder) => ({ id: workOrder.id, label: workOrder.title }))}
            defaultProjectId={selectedProjectId}
            defaultWorkOrderId={params.workOrderId}
          />
        </Card>

        <div className="space-y-3">
          {reports.map((report) => (
            <Card key={report.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-bold">{report.project.title}</p>
                  <p className="text-xs text-[#9fb3ce]">Data: {formatDate(report.reportDate)} • Vreme: {report.weather || "-"}</p>
                  <p className="mt-2 text-sm text-[#dce7f9]">{report.workCompleted}</p>
                  <p className="mt-1 text-xs text-[#9fb3ce]">Blocaje: {report.blockers || "N/A"}</p>
                  <p className="mt-1 text-xs text-[#9fb3ce]">Creat de: {report.createdBy ? `${report.createdBy.firstName} ${report.createdBy.lastName}` : "-"}</p>
                </div>
                <Link href={`/api/rapoarte-zilnice/${report.id}/pdf`}>
                  <Button size="sm" variant="secondary">Export PDF</Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
        <div className="flex items-center justify-between text-sm text-[#9fb3ce]">
          <span>Pagina {page} din {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link
                href={`/rapoarte-zilnice?page=${page - 1}&projectId=${selectedProjectId || ""}&workOrderId=${params.workOrderId || ""}`}
                className="rounded-md border border-[var(--border)] px-3 py-1"
              >
                Anterior
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link
                href={`/rapoarte-zilnice?page=${page + 1}&projectId=${selectedProjectId || ""}&workOrderId=${params.workOrderId || ""}`}
                className="rounded-md border border-[var(--border)] px-3 py-1"
              >
                Urmator
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
}
