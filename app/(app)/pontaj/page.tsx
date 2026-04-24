import { PermissionGuard } from "@/src/components/auth/permission-guard";
import Link from "next/link";
import { TimeEntryStatus } from "@prisma/client";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { EmptyState } from "@/src/components/ui/empty-state";
import { Input } from "@/src/components/ui/input";
import { PageHeader } from "@/src/components/ui/page-header";
import { Table, TD, TH } from "@/src/components/ui/table";
import { ConfirmSubmitButton } from "@/src/components/forms/confirm-submit-button";
import { FormModal } from "@/src/components/forms/form-modal";
import { auth } from "@/src/lib/auth";
import { resolveAccessScope, timeEntryScopeWhere } from "@/src/lib/access-scope";
import { buildListHref, parseDateParam, parseEnumParam, parsePositiveIntParam, resolvePagination } from "@/src/lib/query-params";
import { hasPermission } from "@/src/lib/rbac";
import { formatDate, formatDateTime } from "@/src/lib/utils";
import { prisma } from "@/src/lib/prisma";
import { approveTimeEntry, bulkTimeEntriesAction } from "./actions";
import { PontajCreateForm } from "./pontaj-create-form";

const timeEntryStatusMeta: Record<TimeEntryStatus, { label: string; tone: "success" | "danger" | "warning" | "neutral"; description: string }> = {
  DRAFT: { label: "Draft", tone: "neutral", description: "Inregistrare nefinalizata" },
  SUBMITTED: { label: "Asteapta aprobare", tone: "warning", description: "Trimis la verificare" },
  APPROVED: { label: "Aprobat", tone: "success", description: "Validat pentru salarizare" },
  REJECTED: { label: "Respins", tone: "danger", description: "Cerere respinsa" },
};

function getTimeEntryStatusMeta(status: TimeEntryStatus) {
  return timeEntryStatusMeta[status];
}

function buildPontajHref(page: number, params: { status?: string; projectId?: string; from?: string; to?: string }) {
  return buildListHref("/pontaj", {
    page,
    status: params.status,
    projectId: params.projectId,
    from: params.from,
    to: params.to,
  });
}

export default async function PontajPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; projectId?: string; from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const page = parsePositiveIntParam(params.page);
  const statusFilter = parseEnumParam(params.status, Object.values(TimeEntryStatus));
  const fromDate = parseDateParam(params.from);
  const toDate = params.to ? parseDateParam(`${params.to}T23:59:59`) : undefined;
  const startAtFilter = fromDate || toDate ? { gte: fromDate, lte: toDate } : undefined;
  const pageSize = 20;
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
  const canManageTeamPontaj = userContext.roleKeys.some((role) =>
    ["SUPER_ADMIN", "ADMINISTRATOR", "PROJECT_MANAGER", "SITE_MANAGER", "BACKOFFICE"].includes(role),
  );
  const canCreate = hasPermission(roleKeys, "TIME_TRACKING", "CREATE", userContext.email);
  const canApprove = hasPermission(roleKeys, "TIME_TRACKING", "APPROVE", userContext.email);
  const canExport = hasPermission(roleKeys, "TIME_TRACKING", "EXPORT", userContext.email);
  const where = {
    ...timeEntryScopeWhere(userContext, scope),
    projectId:
      params.projectId && (scope.projectIds === null || scope.projectIds.includes(params.projectId))
        ? params.projectId
        : undefined,
    status: statusFilter,
    startAt: startAtFilter,
  };

  const [projects, workOrders, users, total] = await Promise.all([
    prisma.project.findMany({
      where: {
        deletedAt: null,
        ...(scope.projectIds === null ? {} : { id: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] } }),
      },
      select: { id: true, title: true },
      orderBy: [{ title: "asc" }, { id: "asc" }],
    }),
    prisma.workOrder.findMany({
      where: {
        deletedAt: null,
        ...(scope.projectIds === null ? {} : { projectId: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] } }),
      },
      select: { id: true, title: true, projectId: true },
      orderBy: [{ title: "asc" }, { id: "asc" }],
      take: 100,
    }),
    prisma.user.findMany({
      where: canManageTeamPontaj
        ? { isActive: true, deletedAt: null }
        : { id: userContext.id, isActive: true, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }, { id: "asc" }],
    }),
    prisma.timeEntry.count({ where }),
  ]);
  const { totalPages, currentPage, skip, take } = resolvePagination({
    page,
    totalItems: total,
    pageSize,
  });
  const entries = await prisma.timeEntry.findMany({
    where,
    select: {
      id: true,
      startAt: true,
      endAt: true,
      durationMinutes: true,
      breakMinutes: true,
      status: true,
      approvedAt: true,
      user: { select: { firstName: true, lastName: true } },
      project: { select: { title: true } },
      workOrder: { select: { title: true } },
    },
    orderBy: [{ startAt: "desc" }, { id: "asc" }],
    skip,
    take,
  });
  const submittedEntries = entries.filter((item) => item.status === TimeEntryStatus.SUBMITTED);
  const currentStatusMeta = statusFilter ? getTimeEntryStatusMeta(statusFilter) : null;

  return (
    <PermissionGuard resource="TIME_TRACKING" action="VIEW">
      <div className="space-y-6">
        <PageHeader
          title="Pontaj si timp lucrat"
          subtitle="Inregistrare clara, aprobari rapide si export pentru salarizare - cu statusuri explicate si tura standard vs. tura personalizata."
        />
        {canExport ? (
          <div className="flex justify-end">
            <Link href="/api/export/pontaj">
              <Button variant="secondary">Export CSV Pontaj</Button>
            </Link>
          </div>
        ) : null}

        <Card>
          <div className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-[var(--foreground)]">Filtre rapide</h2>
                <p className="text-sm text-[var(--muted)]">Selecteaza proiectul si intervalul, apoi restrange dupa statusul operational.</p>
              </div>
              <div className="text-xs text-[var(--muted)]">
                <p>In asteptare aprobare = trimis la verificare</p>
                <p>Aprobat = validat pentru plata</p>
                <p>Respins = ramane in istoric</p>
              </div>
            </div>
            <form className="grid gap-3 md:grid-cols-5" method="get">
              <input type="hidden" name="page" value="1" />
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Proiect</label>
                <select name="projectId" defaultValue={params.projectId || ""}>
                  <option value="">Toate proiectele</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.title}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Status</label>
                <select name="status" defaultValue={statusFilter || ""}>
                  <option value="">Toate statusurile</option>
                  {Object.values(TimeEntryStatus).map((status) => {
                    const meta = getTimeEntryStatusMeta(status);
                    return (
                      <option key={status} value={status}>
                        {meta.label}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">De la</label>
                <Input type="date" name="from" defaultValue={params.from || ""} />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Pana la</label>
                <Input type="date" name="to" defaultValue={params.to || ""} />
              </div>
              <div className="flex items-end">
                <Button type="submit" variant="secondary" className="w-full">
                  Filtreaza
                </Button>
              </div>
            </form>
            <div className="flex flex-wrap gap-2 text-xs text-[var(--muted)]">
              <span className="rounded-full border border-[var(--border)] px-2.5 py-1">Tura standard = final implicit 17:00</span>
              <span className="rounded-full border border-[var(--border)] px-2.5 py-1">Tura personalizata = final completat explicit</span>
              {currentStatusMeta ? (
                <span className="rounded-full border border-[var(--border)] px-2.5 py-1">Filtru activ: {currentStatusMeta.label}</span>
              ) : null}
            </div>
          </div>
        </Card>

        {canCreate ? (
          <Card>
            <div className="space-y-2">
              <div>
                <h2 className="text-lg font-semibold text-[var(--foreground)]">Adauga pontaj</h2>
                <p className="text-sm text-[var(--muted)]">
                  Completeaza startul, apoi alege intre tura standard si tura personalizata. Daca finalizezi tura acum, seteaza si ora de final.
                </p>
              </div>
              <FormModal
                triggerLabel="Adauga pontaj"
                title="Inregistrare pontaj"
                description="Selecteaza proiectul, utilizatorul si intervalul orar."
              >
                <PontajCreateForm
                  projects={projects.map((project) => ({ id: project.id, label: project.title }))}
                  workOrders={workOrders.map((item) => ({ id: item.id, label: item.title, projectId: item.projectId }))}
                  users={users.map((user) => ({ id: user.id, label: `${user.firstName} ${user.lastName}` }))}
                  canSelectUser={canManageTeamPontaj}
                />
              </FormModal>
            </div>
          </Card>
        ) : null}

        {canApprove ? (
          <Card className="bulk-zone">
            <details>
              <summary>Actiuni bulk pentru pontajele in asteptare</summary>
              <div className="mt-2 text-xs text-[var(--muted)]">Se pot procesa doar inregistrarile in asteptare de aprobare. Selecteaza doar ce verifici acum.</div>
              <form action={bulkTimeEntriesAction} className="mt-3 space-y-3">
                <div className="bulk-controls grid gap-2 md:grid-cols-3">
                  <select name="operation" defaultValue="APPROVE">
                    <option value="APPROVE">Aproba selectie</option>
                    <option value="REJECT">Respinge selectie</option>
                  </select>
                  <div className="hidden md:block" />
                  <ConfirmSubmitButton text="Executa bulk" confirmMessage="Confirmi actiunea bulk pentru pontajele selectate?" />
                </div>
                <div className="max-h-36 overflow-y-auto rounded-xl border border-[var(--border)] p-3">
                  {submittedEntries.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">Nu exista pontaje in asteptare de aprobare in pagina curenta.</p>
                  ) : (
                    <div className="grid gap-1 md:grid-cols-2">
                      {submittedEntries.map((entry) => (
                        <label key={entry.id} className="flex items-center gap-2 text-sm text-[var(--muted-strong)]">
                          <input type="checkbox" name="ids" value={entry.id} className="h-4 w-4" />
                          <span>
                            {entry.user.firstName} {entry.user.lastName} - {entry.project.title}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </form>
            </details>
          </Card>
        ) : null}

        <Card>
          {entries.length === 0 ? (
            <EmptyState title="Nu exista pontaj" description="Adauga prima inregistrare de timp sau schimba filtrele." />
          ) : (
            <div>
            <div className="space-y-4 lg:hidden">
              {entries.map((entry) => {
                const meta = getTimeEntryStatusMeta(entry.status);
                return (
                  <div key={entry.id} className="relative overflow-hidden rounded-2xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(21,33,48,0.5),rgba(15,25,37,0.5))] p-5 shadow-sm">
                    <div className="mb-4 flex items-start justify-between gap-3 border-b border-[var(--border)]/50 pb-3">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-base font-bold text-[var(--foreground)]">
                          {entry.user.firstName} {entry.user.lastName}
                        </p>
                        <p className="mt-0.5 truncate text-xs font-medium text-[#9fb9d7]">{entry.project.title}</p>
                      </div>
                      <Badge tone={meta.tone} className="shrink-0">{meta.label}</Badge>
                    </div>

                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 rounded-xl bg-[rgba(13,20,30,0.4)] p-3 text-xs">
                        <div className="space-y-1">
                          <p className="font-bold uppercase tracking-wider text-[var(--muted)] text-[9px]">Durata</p>
                          <p className="text-sm font-bold text-[var(--foreground)]">{Math.round(entry.durationMinutes / 60)} h</p>
                        </div>
                        <div className="space-y-1">
                          <p className="font-bold uppercase tracking-wider text-[var(--muted)] text-[9px]">Pauza</p>
                          <p className="text-sm font-bold text-[var(--foreground)]">{entry.breakMinutes} min</p>
                        </div>
                      </div>

                      <div className="space-y-2 text-xs">
                        <div className="flex flex-col gap-1 border-b border-[var(--border)]/30 pb-2">
                          <p className="font-medium text-[var(--muted)]">Interval:</p>
                          <p className="text-[var(--foreground)]">
                            {formatDateTime(entry.startAt)} 
                            <span className="mx-1 text-[var(--muted)]">→</span>
                            {entry.endAt ? formatDateTime(entry.endAt) : <span className="text-[#8dc1f5]">In curs...</span>}
                          </p>
                        </div>
                        {entry.workOrder && (
                          <p className="flex items-center gap-1.5">
                            <span className="font-medium text-[var(--muted)]">Lucrare:</span>
                            <span className="truncate text-[var(--foreground)]">{entry.workOrder.title}</span>
                          </p>
                        )}
                        <p className="text-[11px] italic text-[var(--muted)]">{meta.description}</p>
                      </div>

                      {entry.status === TimeEntryStatus.SUBMITTED && canApprove ? (
                        <form action={approveTimeEntry} className="mt-2 pt-2 border-t border-[var(--border)]/30">
                          <input type="hidden" name="id" value={entry.id} />
                          <Button type="submit" className="h-11 w-full font-bold shadow-lg shadow-[#426990]/20">
                            Aproba Pontaj
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
              <div className="hidden overflow-x-auto rounded-xl border border-[var(--border)] lg:block">
                <Table aria-label="Pontaj">
                  <thead>
                    <tr>
                      <TH>Data</TH>
                      <TH>Angajat</TH>
                      <TH>Proiect</TH>
                      <TH>Lucrare</TH>
                      <TH>Durata</TH>
                      <TH>Pauza</TH>
                      <TH>Status</TH>
                      <TH>Aprobare</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {entries.map((entry) => {
                      const meta = getTimeEntryStatusMeta(entry.status);
                      return (
                        <tr key={entry.id}>
                          <TD>
                            <p>{formatDateTime(entry.startAt)}</p>
                            <p className="text-xs text-[#9fb9d7]">{entry.endAt ? `Pana la ${formatDateTime(entry.endAt)}` : "Tura deschisa"}</p>
                          </TD>
                          <TD>
                            {entry.user.firstName} {entry.user.lastName}
                          </TD>
                          <TD>{entry.project.title}</TD>
                          <TD>{entry.workOrder?.title || "-"}</TD>
                          <TD>{Math.round(entry.durationMinutes / 60)} h</TD>
                          <TD>{entry.breakMinutes} min</TD>
                          <TD>
                            <div className="space-y-1">
                              <Badge tone={meta.tone}>{meta.label}</Badge>
                              <p className="text-xs text-[#9fb9d7]">{meta.description}</p>
                            </div>
                          </TD>
                          <TD>
                            {entry.status === TimeEntryStatus.SUBMITTED && canApprove ? (
                              <form action={approveTimeEntry}>
                                <input type="hidden" name="id" value={entry.id} />
                                <Button type="submit" size="sm">
                                  Aproba
                                </Button>
                              </form>
                            ) : (
                              <span className="text-xs text-[#9fb9d7]">{entry.approvedAt ? formatDate(entry.approvedAt) : "-"}</span>
                            )}
                          </TD>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            </div>
          )}
        </Card>
        <div className="mt-8 flex flex-col items-center justify-between gap-4 border-t border-[var(--border)]/60 pt-6 text-sm text-[var(--muted)] sm:flex-row">
          <span className="font-medium">
            Pagina <span className="text-[var(--foreground)]">{currentPage}</span> din <span className="text-[var(--foreground)]">{totalPages}</span>
          </span>
          <div className="flex w-full gap-3 sm:w-auto">
            {currentPage > 1 ? (
              <Link
                className="flex h-11 flex-1 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-card)] px-5 font-semibold text-[var(--muted-strong)] transition active:scale-95 sm:flex-none"
                href={buildPontajHref(currentPage - 1, { status: statusFilter || undefined, projectId: params.projectId, from: params.from, to: params.to })}
              >
                Anterior
              </Link>
            ) : null}
            {currentPage < totalPages ? (
              <Link
                className="flex h-11 flex-1 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--surface-card)] px-5 font-semibold text-[var(--muted-strong)] transition active:scale-95 sm:flex-none"
                href={buildPontajHref(currentPage + 1, { status: statusFilter || undefined, projectId: params.projectId, from: params.from, to: params.to })}
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
