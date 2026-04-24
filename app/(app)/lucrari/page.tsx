import { Prisma, TaskPriority, WorkOrderStatus } from "@prisma/client";
import Link from "next/link";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { EmptyState } from "@/src/components/ui/empty-state";
import { Input } from "@/src/components/ui/input";
import { PageHeader } from "@/src/components/ui/page-header";
import { TD, TH, Table } from "@/src/components/ui/table";
import { ConfirmSubmitButton } from "@/src/components/forms/confirm-submit-button";
import { FormModal } from "@/src/components/forms/form-modal";
import { auth } from "@/src/lib/auth";
import { resolveAccessScope, workOrderScopeWhere } from "@/src/lib/access-scope";
import { buildListHref, parseEnumParam, parsePositiveIntParam, resolvePagination } from "@/src/lib/query-params";
import { hasPermission } from "@/src/lib/rbac";
import { formatDate } from "@/src/lib/utils";
import { prisma } from "@/src/lib/prisma";
import { bulkWorkOrdersAction, deleteWorkOrder, updateWorkOrderStatus } from "./actions";
import { WorkOrderCreateForm } from "./work-order-create-form";

function isPoolTimeout(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2024";
}

async function withPoolFallback<T>(label: string, query: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await query();
  } catch (error) {
    if (isPoolTimeout(error)) {
      console.warn(`[lucrari] Prisma pool timeout on ${label}. Using fallback data.`);
      return fallback;
    }
    throw error;
  }
}

const workOrderStatusMeta: Record<WorkOrderStatus, { label: string; tone: "neutral" | "info" | "danger" | "success" | "warning" }> = {
  TODO: { label: "De facut", tone: "neutral" },
  IN_PROGRESS: { label: "In lucru", tone: "info" },
  BLOCKED: { label: "Blocat", tone: "danger" },
  REVIEW: { label: "In verificare", tone: "warning" },
  DONE: { label: "Finalizat", tone: "success" },
  CANCELED: { label: "Anulat", tone: "neutral" },
};

const priorityMeta: Record<TaskPriority, { label: string; tone: "neutral" | "info" | "danger" | "success" | "warning" }> = {
  LOW: { label: "Scazuta", tone: "neutral" },
  MEDIUM: { label: "Medie", tone: "info" },
  HIGH: { label: "Ridicata", tone: "warning" },
  CRITICAL: { label: "Critica", tone: "danger" },
};

const workOrderStatusOptions = Object.values(WorkOrderStatus).map((status) => ({
  value: status,
  label: workOrderStatusMeta[status].label,
}));

function getStatusTone(status: WorkOrderStatus) {
  return workOrderStatusMeta[status].tone;
}

function getPriorityTone(priority: TaskPriority) {
  return priorityMeta[priority].tone;
}

function formatPriority(priority: TaskPriority) {
  return priorityMeta[priority].label;
}

function formatWorkOrderStatus(status: WorkOrderStatus) {
  return workOrderStatusMeta[status].label;
}

function formatDeadline(dueDate: Date | null, status: WorkOrderStatus) {
  if (!dueDate) return { label: "Fara termen", tone: "neutral" as const };
  if (status === WorkOrderStatus.DONE || status === WorkOrderStatus.CANCELED) {
    return { label: `Finalizat la ${formatDate(dueDate)}`, tone: "success" as const };
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueStart = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const diffDays = Math.round((dueStart.getTime() - startOfToday.getTime()) / 86400000);

  if (diffDays < 0) return { label: `Restant de ${Math.abs(diffDays)} zile`, tone: "danger" as const };
  if (diffDays === 0) return { label: "Scadenta azi", tone: "warning" as const };
  if (diffDays === 1) return { label: "Scadenta maine", tone: "warning" as const };
  return { label: `Scadenta in ${diffDays} zile`, tone: "neutral" as const };
}

function buildLucrariHref({
  page,
  q,
  status,
  projectId,
}: {
  page?: number;
  q?: string;
  status?: WorkOrderStatus | null;
  projectId?: string;
}) {
  return buildListHref("/lucrari", {
    page,
    q,
    status: status || undefined,
    projectId,
  });
}

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: string; page?: string; projectId?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() || "";
  const statusFilter = parseEnumParam(params.status, Object.values(WorkOrderStatus));
  const page = parsePositiveIntParam(params.page);
  const pageSize = 12;
  const session = await auth();
  const scope = session?.user
    ? await resolveAccessScope({
        id: session.user.id,
        email: session.user.email,
        roleKeys: session.user.roleKeys || [],
      })
    : { projectIds: null, teamId: null };
  const userContext = session?.user
    ? { id: session.user.id, email: session.user.email, roleKeys: session.user.roleKeys || [] }
    : { id: "", email: null, roleKeys: [] };
  const roleKeys = userContext.roleKeys || [];
  const canCreate = hasPermission(roleKeys, "TASKS", "CREATE", userContext.email);
  const canUpdate = hasPermission(roleKeys, "TASKS", "UPDATE", userContext.email);
  const canDelete = hasPermission(roleKeys, "TASKS", "DELETE", userContext.email);

  const where = {
    deletedAt: null,
    project: { deletedAt: null },
    ...workOrderScopeWhere(userContext, scope),
    title: q ? { contains: q, mode: "insensitive" as const } : undefined,
    status: statusFilter,
    projectId:
      params.projectId && (scope.projectIds === null || scope.projectIds.includes(params.projectId))
        ? params.projectId
        : undefined,
  };
  const activeWorkOrderWhere = {
    deletedAt: null,
    project: { deletedAt: null },
    ...workOrderScopeWhere(userContext, scope),
    status: { notIn: [WorkOrderStatus.DONE, WorkOrderStatus.CANCELED] },
  };

  const projects = await withPoolFallback(
    "project.findMany",
    () =>
      prisma.project.findMany({
        where: {
          deletedAt: null,
          ...(scope.projectIds === null ? {} : { id: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] } }),
        },
        select: { id: true, title: true },
        orderBy: [{ title: "asc" }, { id: "asc" }],
      }),
    [],
  );
  const users = await withPoolFallback(
    "user.findMany",
    () =>
      prisma.user.findMany({
        where: { isActive: true, deletedAt: null },
        select: { id: true, firstName: true, lastName: true },
        orderBy: [{ firstName: "asc" }, { id: "asc" }],
      }),
    [],
  );
  const teams = await withPoolFallback(
    "team.findMany",
    () =>
      prisma.team.findMany({
        where: scope.teamId ? { deletedAt: null, id: scope.teamId } : { deletedAt: null },
        select: { id: true, name: true },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
    [],
  );
  const responsibleLoad = await withPoolFallback(
    "workOrder.groupBy.responsibleId",
    () =>
      prisma.workOrder.groupBy({
        by: ["responsibleId"],
        where: { ...activeWorkOrderWhere, responsibleId: { not: null } },
        _count: { _all: true },
      }),
    [],
  );
  const teamLoad = await withPoolFallback(
    "workOrder.groupBy.teamId",
    () =>
      prisma.workOrder.groupBy({
        by: ["teamId"],
        where: { ...activeWorkOrderWhere, teamId: { not: null } },
        _count: { _all: true },
      }),
    [],
  );
  const responsibleWorkloadById = Object.fromEntries(
    responsibleLoad
      .filter((item) => item.responsibleId)
      .map((item) => [item.responsibleId as string, item._count._all]),
  );
  const teamWorkloadById = Object.fromEntries(
    teamLoad
      .filter((item) => item.teamId)
      .map((item) => [item.teamId as string, item._count._all]),
  );
  const total = await withPoolFallback(
    "workOrder.count",
    () => prisma.workOrder.count({ where }),
    0,
  );
  const { totalPages, currentPage, skip, take } = resolvePagination({
    page,
    totalItems: total,
    pageSize,
  });
  const workOrders = await withPoolFallback(
    "workOrder.findMany",
    () =>
      prisma.workOrder.findMany({
        where,
        select: {
          id: true,
          title: true,
          description: true,
          startDate: true,
          dueDate: true,
          priority: true,
          status: true,
          project: { select: { title: true } },
          responsible: { select: { firstName: true, lastName: true } },
          team: { select: { name: true } },
        },
        orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }, { id: "asc" }],
        skip,
        take,
      }),
    [],
  );

  return (
    <PermissionGuard resource="TASKS" action="VIEW">
      <div className="space-y-6">
        <PageHeader title="Lucrari si ordine de lucru" subtitle="Coordonare executie santier, blocaje, termene si aprobari de operare" />

        {canCreate ? (
          <Card>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Creare</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Creare ordin de lucru</h2>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Deschide formularul in dialog pentru a pastra contextul listei si al filtrului curent.
            </p>
            <div className="mt-3">
              <FormModal
                triggerLabel="Adauga ordin de lucru"
                title="Creare ordin de lucru"
                description="Completeaza detaliile de executie, responsabilul si echipa."
              >
                <WorkOrderCreateForm
                  projects={projects.map((project) => ({ id: project.id, label: project.title }))}
                  users={users.map((user) => ({ id: user.id, label: `${user.firstName} ${user.lastName}` }))}
                  teams={teams.map((team) => ({ id: team.id, label: team.name }))}
                  responsibleWorkloadById={responsibleWorkloadById}
                  teamWorkloadById={teamWorkloadById}
                />
              </FormModal>
            </div>
          </Card>
        ) : null}

        {canUpdate || canDelete ? (
          <Card className="bulk-zone">
            <details>
              <summary>Actiuni bulk lucrari</summary>
              <form action={bulkWorkOrdersAction} className="mt-3 space-y-3">
              <div className="bulk-controls grid gap-2 md:grid-cols-3">
                <select
                  name="operation"
                  defaultValue={canUpdate ? "SET_STATUS" : "DELETE"}
                >
                  {canUpdate ? <option value="SET_STATUS">Actualizeaza status</option> : null}
                  {canDelete ? <option value="DELETE">Sterge logic (CANCELED)</option> : null}
                </select>
                <select name="status" defaultValue={WorkOrderStatus.IN_PROGRESS} disabled={!canUpdate}>
                  {workOrderStatusOptions.map((status) => (
                    <option key={status.value} value={status.value}>
                      {status.label}
                    </option>
                  ))}
                </select>
                <ConfirmSubmitButton text="Executa bulk" confirmMessage="Confirmi actiunea bulk pe lucrarile selectate?" />
              </div>
              <div className="max-h-36 overflow-y-auto rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3">
                <div className="grid gap-1 md:grid-cols-2">
                  {workOrders.map((item) => (
                    <label key={item.id} className="flex items-center gap-2 text-sm text-[var(--muted-strong)]">
                      <input type="checkbox" name="ids" value={item.id} className="h-4 w-4" />
                      <span>{item.title}</span>
                    </label>
                  ))}
                </div>
              </div>
              </form>
            </details>
          </Card>
        ) : null}

        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Filtre</p>
          <form className="mb-4 mt-2 grid gap-3 md:grid-cols-4">
            <input type="hidden" name="page" value="1" />
            <Input name="q" placeholder="Cauta lucrare" defaultValue={q} />
            <select name="status" defaultValue={statusFilter || ""}>
              <option value="">Toate statusurile</option>
              {workOrderStatusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
            <select name="projectId" defaultValue={params.projectId || ""}>
              <option value="">Toate proiectele</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary">
              Filtreaza
            </Button>
          </form>

          {workOrders.length === 0 ? (
            <EmptyState title="Nu exista lucrari" description="Adauga primul ordin de lucru pentru santier." />
          ) : (
            <div>
                <div className="space-y-3 lg:hidden">
              {workOrders.map((item) => (
                <div key={item.id} className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={`/lucrari/${item.id}`} className="font-semibold text-[var(--muted-strong)] hover:underline">
                        {item.title}
                      </Link>
                    <p className="text-xs text-[var(--muted)]">{item.project.title}</p>
                  </div>
                    <Badge tone={getStatusTone(item.status)}>
                      {formatWorkOrderStatus(item.status)}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-[var(--muted)]">{item.description?.slice(0, 120) || "-"}</p>
                  <div className="mt-2 grid grid-cols-1 gap-2 text-xs text-[var(--muted-strong)] sm:grid-cols-2">
                    <p>
                      Responsabil: {item.responsible ? `${item.responsible.firstName} ${item.responsible.lastName}` : "nealocat"}
                    </p>
                    <p>Echipa: {item.team?.name || "fara echipa"}</p>
                    <p>Start: {item.startDate ? formatDate(item.startDate) : "nedefinit"}</p>
                    <p>Termen: {item.dueDate ? formatDate(item.dueDate) : "nedefinit"}</p>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2">
                    <Badge tone={getPriorityTone(item.priority)}>{formatPriority(item.priority)}</Badge>
                    <Badge tone={formatDeadline(item.dueDate, item.status).tone}>{formatDeadline(item.dueDate, item.status).label}</Badge>
                  </div>
                  {canUpdate || canDelete ? (
                    <div className="mt-3 space-y-2">
                      {canUpdate ? (
                        <form action={updateWorkOrderStatus} className="grid grid-cols-[1fr_auto] gap-2">
                          <input type="hidden" name="id" value={item.id} />
                          <select name="status" defaultValue={item.status} className="h-10 rounded-md px-2 text-sm">
                            {workOrderStatusOptions.map((status) => (
                              <option key={status.value} value={status.value}>
                                {status.label}
                              </option>
                            ))}
                          </select>
                          <Button variant="ghost" size="sm" type="submit">
                            Salveaza
                          </Button>
                        </form>
                      ) : null}
                      {canDelete ? (
                        <form action={deleteWorkOrder}>
                          <input type="hidden" name="id" value={item.id} />
                          <Button variant="destructive" size="sm" type="submit" className="w-full">
                            Sterge
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] lg:block">
              <Table>
                <thead>
                  <tr>
                    <TH>TITLU</TH>
                    <TH>PROIECT</TH>
                    <TH>RESPONSABIL</TH>
                    <TH>ECHIPA</TH>
                    <TH>PROGRAM</TH>
                    <TH>PRIORITATE</TH>
                    <TH>STATUS</TH>
                    <TH>ACTIUNI</TH>
                  </tr>
                </thead>
                <tbody>
                  {workOrders.map((item) => (
                    <tr key={item.id}>
                      <TD>
                        <Link href={`/lucrari/${item.id}`} className="font-semibold text-[var(--muted-strong)] hover:underline">
                          {item.title}
                        </Link>
                        <p className="text-xs text-[var(--muted)]">{item.description?.slice(0, 92) || "-"}</p>
                      </TD>
                      <TD>{item.project.title}</TD>
                      <TD>
                        <p>{item.responsible ? `${item.responsible.firstName} ${item.responsible.lastName}` : "Nealocat"}</p>
                        <p className="text-xs text-[var(--muted)]">Persoana notificata la schimbari</p>
                      </TD>
                      <TD>
                        <p>{item.team?.name || "Fara echipa"}</p>
                        <p className="text-xs text-[var(--muted)]">Disponibilitate calculata pe lucrari active</p>
                      </TD>
                      <TD>
                        <p>{item.startDate ? formatDate(item.startDate) : "Fara start"}</p>
                        <p className="text-xs text-[var(--muted)]">{item.dueDate ? formatDate(item.dueDate) : "Fara termen"}</p>
                      </TD>
                      <TD>
                        <Badge tone={getPriorityTone(item.priority)}>{formatPriority(item.priority)}</Badge>
                      </TD>
                      <TD>
                        <Badge tone={getStatusTone(item.status)}>{formatWorkOrderStatus(item.status)}</Badge>
                      </TD>
                      <TD>
                        {canUpdate || canDelete ? (
                          <div className="flex gap-2">
                            {canUpdate ? (
                              <form action={updateWorkOrderStatus}>
                                <input type="hidden" name="id" value={item.id} />
                                <select name="status" defaultValue={item.status} className="h-9 rounded-md px-2 text-xs">
                                  {workOrderStatusOptions.map((status) => (
                                    <option key={status.value} value={status.value}>
                                      {status.label}
                                    </option>
                                  ))}
                                </select>
                                <Button variant="ghost" size="sm" className="ml-1" type="submit">
                                  Salveaza
                                </Button>
                              </form>
                            ) : null}
                            {canDelete ? (
                              <form action={deleteWorkOrder}>
                                <input type="hidden" name="id" value={item.id} />
                                <Button variant="destructive" size="sm" type="submit">
                                  Sterge
                                </Button>
                              </form>
                            ) : null}
                          </div>
                        ) : (
                          <span className="text-xs text-[var(--muted)]">Fara drept de editare</span>
                        )}
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
            </div>
          )}

          <div className="mt-5 flex flex-col items-center justify-between gap-3 border-t border-[var(--border)]/60 pt-4 text-sm text-[var(--muted)] sm:flex-row">
            <span>
              Pagina {currentPage} din {totalPages}
            </span>
            <div className="flex gap-2">
              {currentPage > 1 ? (
                <Link className="rounded-lg border border-[var(--border)] px-3 py-1.5 hover:border-[var(--border-strong)]" href={buildLucrariHref({
                  page: currentPage - 1,
                  q: q || undefined,
                  status: statusFilter,
                  projectId: params.projectId,
                })}>
                  Anterior
                </Link>
              ) : null}
              {currentPage < totalPages ? (
                <Link className="rounded-lg border border-[var(--border)] px-3 py-1.5 hover:border-[var(--border-strong)]" href={buildLucrariHref({
                  page: currentPage + 1,
                  q: q || undefined,
                  status: statusFilter,
                  projectId: params.projectId,
                })}>
                  Urmator
                </Link>
              ) : null}
            </div>
          </div>
        </Card>
      </div>
    </PermissionGuard>
  );
}
