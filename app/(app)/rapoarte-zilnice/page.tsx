import Link from "next/link";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { FormModal } from "@/src/components/forms/form-modal";
import { PageHeader } from "@/src/components/ui/page-header";
import { auth } from "@/src/lib/auth";
import { resolveAccessScope } from "@/src/lib/access-scope";
import { buildListHref, parsePositiveIntParam, resolvePagination } from "@/src/lib/query-params";
import { hasPermission } from "@/src/lib/rbac";
import { formatDate } from "@/src/lib/utils";
import { prisma } from "@/src/lib/prisma";
import { DailyReportCreateForm } from "./daily-report-create-form";

function buildRapoarteHref({
  page,
  projectId,
  workOrderId,
}: {
  page?: number;
  projectId?: string;
  workOrderId?: string;
}) {
  return buildListHref("/rapoarte-zilnice", {
    page,
    projectId,
    workOrderId,
  });
}

export default async function RapoarteZilnicePage({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string; workOrderId?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = parsePositiveIntParam(params.page);
  const pageSize = 20;
  const session = await auth();
  const roleKeys = session?.user?.roleKeys || [];
  const userEmail = session?.user?.email || null;
  const canCreate = hasPermission(roleKeys, "REPORTS", "CREATE", userEmail);
  const canExport = hasPermission(roleKeys, "REPORTS", "EXPORT", userEmail);
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

  const [projects, workOrders, totalReports, blockersCount, workersSummary] = await Promise.all([
    prisma.project.findMany({
      where: { deletedAt: null, ...(scope.projectIds === null ? {} : { id: scopedProjectFilter! }) },
      select: { id: true, title: true },
      orderBy: [{ title: "asc" }, { id: "asc" }],
    }),
    prisma.workOrder.findMany({
      where: workOrdersWhere,
      select: { id: true, title: true, projectId: true },
      orderBy: [{ title: "asc" }, { id: "asc" }],
      take: 100,
    }),
    prisma.dailySiteReport.count({ where: reportsWhere }),
    prisma.dailySiteReport.count({
      where: {
        ...reportsWhere,
        blockers: { not: null },
        NOT: { blockers: "" },
      },
    }),
    prisma.dailySiteReport.aggregate({
      where: reportsWhere,
      _sum: { workersCount: true },
    }),
  ]);
  const { totalPages, currentPage, skip, take } = resolvePagination({
    page,
    totalItems: totalReports,
    pageSize,
  });
  const reports = await prisma.dailySiteReport.findMany({
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
    orderBy: [{ reportDate: "desc" }, { id: "asc" }],
    skip,
    take,
  });
  const totalWorkers = workersSummary._sum.workersCount ?? 0;

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
        {canExport ? (
          <div className="flex justify-end">
            <Link href="/api/export/rapoarte">
              <Button variant="secondary">Export CSV Rapoarte</Button>
            </Link>
          </div>
        ) : null}

        <section className="grid gap-3 md:grid-cols-3">
          <Card>
            <p className="text-xs text-[#9fb2ce]">Rapoarte recente</p>
            <p className="mt-2 text-2xl font-semibold">{totalReports}</p>
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

        {canCreate ? (
          <Card>
            <h2 className="text-lg font-extrabold">Raport nou</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">Deschide formularul in dialog pentru completare rapida fara pierderea contextului.</p>
            <div className="mt-3">
              <FormModal
                triggerLabel="Adauga raport zilnic"
                title="Raport zilnic santier"
                description="Completeaza vremea, progresul si blocajele pentru ziua curenta."
              >
                <DailyReportCreateForm
                  projects={projects.map((project) => ({ id: project.id, label: project.title }))}
                  workOrders={workOrders.map((workOrder) => ({
                    id: workOrder.id,
                    label: workOrder.title,
                    projectId: workOrder.projectId,
                  }))}
                  defaultProjectId={selectedProjectId}
                  defaultWorkOrderId={params.workOrderId}
                />
              </FormModal>
            </div>
          </Card>
        ) : null}

        <div className="space-y-3">
          {reports.map((report) => (
            <Card key={report.id}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-base font-bold">{report.project.title}</p>
                  <p className="text-xs text-[var(--muted)]">Data: {formatDate(report.reportDate)} • Vreme: {report.weather || "-"}</p>
                  <p className="mt-2 text-sm text-[var(--muted-strong)]">{report.workCompleted}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">Blocaje: {report.blockers || "N/A"}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">Creat de: {report.createdBy ? `${report.createdBy.firstName} ${report.createdBy.lastName}` : "-"}</p>
                </div>
                <Link href={`/api/rapoarte-zilnice/${report.id}/pdf`}>
                  <Button size="sm" variant="secondary">Export PDF</Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
        <div className="flex items-center justify-between text-sm text-[var(--muted)]">
          <span>Pagina {currentPage} din {totalPages}</span>
          <div className="flex gap-2">
            {currentPage > 1 ? (
              <Link
                href={buildRapoarteHref({
                  page: currentPage - 1,
                  projectId: selectedProjectId,
                  workOrderId: params.workOrderId || undefined,
                })}
                className="rounded-md border border-[var(--border)] px-3 py-1"
              >
                Anterior
              </Link>
            ) : null}
            {currentPage < totalPages ? (
              <Link
                href={buildRapoarteHref({
                  page: currentPage + 1,
                  projectId: selectedProjectId,
                  workOrderId: params.workOrderId || undefined,
                })}
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
