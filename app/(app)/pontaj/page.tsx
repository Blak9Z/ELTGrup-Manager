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
import { auth } from "@/src/lib/auth";
import { resolveAccessScope, timeEntryScopeWhere } from "@/src/lib/access-scope";
import { parseDateParam, parseEnumParam, parsePositiveIntParam } from "@/src/lib/query-params";
import { hasPermission } from "@/src/lib/rbac";
import { formatDate, formatDateTime } from "@/src/lib/utils";
import { prisma } from "@/src/lib/prisma";
import { approveTimeEntry, bulkTimeEntriesAction } from "./actions";
import { PontajCreateForm } from "./pontaj-create-form";

const timeEntryStatusMeta: Record<TimeEntryStatus, { label: string; tone: "success" | "danger" | "warning" | "neutral"; description: string }> = {
  DRAFT: { label: "Draft", tone: "neutral", description: "Inregistrare nefinalizata" },
  SUBMITTED: { label: "Asteapta aprobare", tone: "warning", description: "Trimis la verificare" },
  APPROVED: { label: "Aprobat", tone: "success", description: "Validat pentru payroll" },
  REJECTED: { label: "Respins", tone: "danger", description: "Cerere respinsa" },
};

function getTimeEntryStatusMeta(status: TimeEntryStatus) {
  return timeEntryStatusMeta[status];
}

function buildPontajHref(page: number, params: { status?: string; projectId?: string; from?: string; to?: string }) {
  const searchParams = new URLSearchParams();
  searchParams.set("page", String(page));
  if (params.status) searchParams.set("status", params.status);
  if (params.projectId) searchParams.set("projectId", params.projectId);
  if (params.from) searchParams.set("from", params.from);
  if (params.to) searchParams.set("to", params.to);
  return `/pontaj?${searchParams.toString()}`;
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

  const [projects, workOrders, users, entries, total] = await Promise.all([
    prisma.project.findMany({
      where: {
        deletedAt: null,
        ...(scope.projectIds === null ? {} : { id: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] } }),
      },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    prisma.workOrder.findMany({
      where: {
        deletedAt: null,
        ...(scope.projectIds === null ? {} : { projectId: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] } }),
      },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
      take: 100,
    }),
    prisma.user.findMany({
      where: canManageTeamPontaj
        ? { isActive: true, deletedAt: null }
        : { id: userContext.id, isActive: true, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.timeEntry.findMany({
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
      orderBy: { startAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.timeEntry.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const submittedEntries = entries.filter((item) => item.status === TimeEntryStatus.SUBMITTED);
  const currentStatusMeta = statusFilter ? getTimeEntryStatusMeta(statusFilter) : null;

  return (
    <PermissionGuard resource="TIME_TRACKING" action="VIEW">
      <div className="space-y-6">
        <PageHeader
          title="Pontaj si timp lucrat"
          subtitle="Inregistrare clara, aprobari rapide si export pentru payroll - cu statusuri explicitate si tura standard vs. tura custom."
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
                <p>SUBMITTED = la aprobare</p>
                <p>APPROVED = validat pentru payroll</p>
                <p>REJECTED = respins si vizibil in istoric</p>
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
              <span className="rounded-full border border-[var(--border)] px-2.5 py-1">Tura custom = final completat explicit</span>
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
                  Completeaza startul, apoi alege intre tura standard si tura custom. Daca finalizezi tura acum, seteaza si ora de final.
                </p>
              </div>
              <PontajCreateForm
                projects={projects.map((project) => ({ id: project.id, label: project.title }))}
                workOrders={workOrders.map((item) => ({ id: item.id, label: item.title }))}
                users={users.map((user) => ({ id: user.id, label: `${user.firstName} ${user.lastName}` }))}
                canSelectUser={canManageTeamPontaj}
              />
            </div>
          </Card>
        ) : null}

        {canApprove ? (
          <Card className="bulk-zone">
            <details>
              <summary>Actiuni bulk pentru pontajele in asteptare</summary>
              <div className="mt-2 text-xs text-[var(--muted)]">Se pot procesa doar inregistrarile SUBMITTED. Selecteaza doar ce verifici acum.</div>
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
                    <p className="text-sm text-[var(--muted)]">Nu exista pontaje SUBMITTED in pagina curenta.</p>
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
              <div className="space-y-3 md:hidden">
                {entries.map((entry) => {
                  const meta = getTimeEntryStatusMeta(entry.status);
                  return (
                    <div key={entry.id} className="rounded-xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(10,24,40,0.9),rgba(8,19,32,0.9))] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[#e7f1ff]">
                            {entry.user.firstName} {entry.user.lastName}
                          </p>
                          <p className="text-xs text-[#9fb9d7]">{entry.project.title}</p>
                        </div>
                        <Badge tone={meta.tone}>{meta.label}</Badge>
                      </div>
                      <p className="mt-2 text-xs text-[#9fb9d7]">
                        {formatDateTime(entry.startAt)} {entry.endAt ? `- ${formatDateTime(entry.endAt)}` : "(tura inca este deschisa)"}
                      </p>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[var(--muted-strong)]">
                        <p>Durata: {Math.round(entry.durationMinutes / 60)} h</p>
                        <p>Pauza: {entry.breakMinutes} min</p>
                      </div>
                      <p className="mt-2 text-xs text-[var(--muted)]">{meta.description}</p>
                      {entry.status === TimeEntryStatus.SUBMITTED && canApprove ? (
                        <form action={approveTimeEntry} className="mt-3">
                          <input type="hidden" name="id" value={entry.id} />
                          <Button type="submit" size="sm" className="w-full">
                            Aproba pontaj
                          </Button>
                        </form>
                      ) : null}
                    </div>
                  );
                })}
              </div>
              <div className="hidden overflow-x-auto rounded-xl border border-[var(--border)] md:block">
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
        <div className="flex items-center justify-between text-sm text-[#9cb0cb]">
          <span>
            Pagina {page} din {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link className="rounded-lg border border-[var(--border)] px-3 py-1.5 hover:border-[var(--border-strong)]" href={buildPontajHref(page - 1, { status: statusFilter || undefined, projectId: params.projectId, from: params.from, to: params.to })}>
                Anterior
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link className="rounded-lg border border-[var(--border)] px-3 py-1.5 hover:border-[var(--border-strong)]" href={buildPontajHref(page + 1, { status: statusFilter || undefined, projectId: params.projectId, from: params.from, to: params.to })}>
                Urmator
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
}
