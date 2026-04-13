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
import { formatDate, formatDateTime } from "@/src/lib/utils";
import { prisma } from "@/src/lib/prisma";
import { approveTimeEntry, bulkTimeEntriesAction } from "./actions";
import { PontajCreateForm } from "./pontaj-create-form";

export default async function PontajPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: TimeEntryStatus; projectId?: string; from?: string; to?: string }>;
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
  const userContext = session?.user
    ? { id: session.user.id, email: session.user.email, roleKeys: session.user.roleKeys || [] }
    : { id: "", email: null, roleKeys: [] };
  const where = {
    ...timeEntryScopeWhere(userContext, scope),
    projectId:
      params.projectId && (scope.projectIds === null || scope.projectIds.includes(params.projectId))
        ? params.projectId
        : undefined,
    status: params.status || undefined,
    startAt: {
      gte: params.from ? new Date(params.from) : undefined,
      lte: params.to ? new Date(`${params.to}T23:59:59`) : undefined,
    },
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
      where: { isActive: true, deletedAt: null },
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

  return (
    <PermissionGuard resource="TIME_TRACKING" action="VIEW">
      <div className="space-y-6">
        <PageHeader title="Pontaj si timp lucrat" subtitle="Inregistrare, aprobare si export ore pentru payroll operational" />
        <div className="flex justify-end">
          <Link href="/api/export/pontaj">
            <Button variant="secondary">Export CSV Pontaj</Button>
          </Link>
        </div>

        <Card>
          <form className="grid gap-3 md:grid-cols-5">
            <input type="hidden" name="page" value="1" />
            <select name="projectId" defaultValue={params.projectId || ""}>
              <option value="">Toate proiectele</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.title}
                </option>
              ))}
            </select>
            <select name="status" defaultValue={params.status || ""}>
              <option value="">Toate statusurile</option>
              {Object.values(TimeEntryStatus).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <Input type="date" name="from" defaultValue={params.from || ""} />
            <Input type="date" name="to" defaultValue={params.to || ""} />
            <Button type="submit" variant="secondary">
              Filtreaza
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="text-lg font-semibold text-[#f2f9ff]">Adauga inregistrare pontaj</h2>
          <PontajCreateForm
            projects={projects.map((project) => ({ id: project.id, label: project.title }))}
            workOrders={workOrders.map((item) => ({ id: item.id, label: item.title }))}
            users={users.map((user) => ({ id: user.id, label: `${user.firstName} ${user.lastName}` }))}
          />
        </Card>

        <Card className="bulk-zone">
          <details>
            <summary>Actiuni bulk pontaj</summary>
            <form action={bulkTimeEntriesAction} className="mt-3 space-y-3">
            <div className="bulk-controls grid gap-2 md:grid-cols-3">
              <select name="operation" defaultValue="APPROVE">
                <option value="APPROVE">Aproba selectie</option>
                <option value="REJECT">Respinge selectie</option>
              </select>
              <div />
              <ConfirmSubmitButton text="Executa bulk" confirmMessage="Confirmi actiunea bulk pentru pontajele selectate?" />
            </div>
            <div className="max-h-36 overflow-y-auto rounded-xl border border-[var(--border)] p-3">
              <div className="grid gap-1 md:grid-cols-2">
                {entries
                  .filter((item) => item.status === "SUBMITTED")
                  .map((entry) => (
                    <label key={entry.id} className="flex items-center gap-2 text-sm text-[#dce7f9]">
                      <input type="checkbox" name="ids" value={entry.id} className="h-4 w-4" />
                      <span>
                        {entry.user.firstName} {entry.user.lastName} - {entry.project.title}
                      </span>
                    </label>
                  ))}
              </div>
            </div>
            </form>
          </details>
        </Card>

        <Card>
          {entries.length === 0 ? (
            <EmptyState title="Nu exista pontaj" description="Adauga prima inregistrare de timp." />
          ) : (
            <div>
            <div className="space-y-3 md:hidden">
              {entries.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(10,24,40,0.9),rgba(8,19,32,0.9))] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[#e7f1ff]">{entry.user.firstName} {entry.user.lastName}</p>
                      <p className="text-xs text-[#9fb9d7]">{entry.project.title}</p>
                    </div>
                    <Badge tone={entry.status === "APPROVED" ? "success" : entry.status === "REJECTED" ? "danger" : "warning"}>{entry.status}</Badge>
                  </div>
                  <p className="mt-2 text-xs text-[#9fb9d7]">{formatDateTime(entry.startAt)} {entry.endAt ? `- ${formatDateTime(entry.endAt)}` : "(deschis)"}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#d6e4f9]">
                    <p>Durata: {Math.round(entry.durationMinutes / 60)} h</p>
                    <p>Pauza: {entry.breakMinutes} min</p>
                  </div>
                  {entry.status === "SUBMITTED" ? (
                    <form action={approveTimeEntry} className="mt-3">
                      <input type="hidden" name="id" value={entry.id} />
                      <Button type="submit" size="sm" className="w-full">
                        Aproba
                      </Button>
                    </form>
                  ) : null}
                </div>
              ))}
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
                  {entries.map((entry) => (
                    <tr key={entry.id}>
                      <TD>
                        <p>{formatDateTime(entry.startAt)}</p>
                        <p className="text-xs text-[#9fb9d7]">{entry.endAt ? `Pana la ${formatDateTime(entry.endAt)}` : "Sesiune deschisa"}</p>
                      </TD>
                      <TD>
                        {entry.user.firstName} {entry.user.lastName}
                      </TD>
                      <TD>{entry.project.title}</TD>
                      <TD>{entry.workOrder?.title || "-"}</TD>
                      <TD>{Math.round(entry.durationMinutes / 60)} h</TD>
                      <TD>{entry.breakMinutes} min</TD>
                      <TD>
                        <Badge tone={entry.status === "APPROVED" ? "success" : entry.status === "REJECTED" ? "danger" : "warning"}>{entry.status}</Badge>
                      </TD>
                      <TD>
                        {entry.status === "SUBMITTED" ? (
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
                  ))}
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
              <Link className="rounded-lg border border-[var(--border)] px-3 py-1.5 hover:border-[#4f6d8f]" href={`/pontaj?page=${page - 1}&status=${params.status || ""}&projectId=${params.projectId || ""}&from=${params.from || ""}&to=${params.to || ""}`}>
                Anterior
              </Link>
            ) : null}
            {page < totalPages ? (
              <Link className="rounded-lg border border-[var(--border)] px-3 py-1.5 hover:border-[#4f6d8f]" href={`/pontaj?page=${page + 1}&status=${params.status || ""}&projectId=${params.projectId || ""}&from=${params.from || ""}&to=${params.to || ""}`}>
                Urmator
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
}
