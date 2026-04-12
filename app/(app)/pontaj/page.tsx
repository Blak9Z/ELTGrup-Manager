import { PermissionGuard } from "@/src/components/auth/permission-guard";
import Link from "next/link";
import { TimeEntryStatus } from "@prisma/client";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { EmptyState } from "@/src/components/ui/empty-state";
import { Input } from "@/src/components/ui/input";
import { PageHeader } from "@/src/components/ui/page-header";
import { TH, TD, Table } from "@/src/components/ui/table";
import { ConfirmSubmitButton } from "@/src/components/forms/confirm-submit-button";
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
  const where = {
    projectId: params.projectId || undefined,
    status: params.status || undefined,
    startAt: {
      gte: params.from ? new Date(params.from) : undefined,
      lte: params.to ? new Date(`${params.to}T23:59:59`) : undefined,
    },
  };

  const [projects, workOrders, entries, total] = await Promise.all([
    prisma.project.findMany({ where: { deletedAt: null }, orderBy: { title: "asc" } }),
    prisma.workOrder.findMany({ where: { deletedAt: null }, orderBy: { title: "asc" }, take: 100 }),
    prisma.timeEntry.findMany({
      where,
      include: { user: true, project: true, workOrder: true },
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
        <PageHeader title="Pontaj si timp lucrat" subtitle="Timer, corectii, overtime, aprobare si export payroll-ready" />
        <div className="flex justify-end">
          <Link href="/api/export/pontaj">
            <Button variant="secondary">Export Excel Pontaj</Button>
          </Link>
        </div>

        <Card>
          <form className="grid gap-3 md:grid-cols-5">
            <input type="hidden" name="page" value="1" />
            <select name="projectId" defaultValue={params.projectId || ""} className="h-10 rounded-lg border border-[#cfddd3] px-3 text-sm">
              <option value="">Toate proiectele</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.title}</option>
              ))}
            </select>
            <select name="status" defaultValue={params.status || ""} className="h-10 rounded-lg border border-[#cfddd3] px-3 text-sm">
              <option value="">Toate statusurile</option>
              {Object.values(TimeEntryStatus).map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <Input type="date" name="from" defaultValue={params.from || ""} />
            <Input type="date" name="to" defaultValue={params.to || ""} />
            <Button type="submit" variant="secondary">Filtreaza</Button>
          </form>
        </Card>

        <Card>
          <h2 className="text-lg font-extrabold">Adauga inregistrare pontaj</h2>
          <PontajCreateForm
            projects={projects.map((project) => ({ id: project.id, label: project.title }))}
            workOrders={workOrders.map((item) => ({ id: item.id, label: item.title }))}
          />
        </Card>

        <Card>
          <h2 className="text-lg font-extrabold">Actiuni bulk pontaj</h2>
          <form action={bulkTimeEntriesAction} className="mt-3 space-y-3">
            <div className="grid gap-2 md:grid-cols-3">
              <select name="operation" defaultValue="APPROVE" className="h-10 rounded-lg border border-[#cfddd3] px-3 text-sm">
                <option value="APPROVE">Aproba selectie</option>
                <option value="REJECT">Respinge selectie</option>
              </select>
              <div />
              <ConfirmSubmitButton text="Executa bulk" confirmMessage="Confirmi actiunea bulk pentru pontajele selectate?" />
            </div>
            <div className="max-h-36 overflow-y-auto rounded-lg border border-[#dce8df] p-2">
              <div className="grid gap-1 md:grid-cols-2">
                {entries.filter((item) => item.status === "SUBMITTED").map((entry) => (
                  <label key={entry.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="ids" value={entry.id} />
                    <span>{entry.user.firstName} {entry.user.lastName} - {entry.project.title}</span>
                  </label>
                ))}
              </div>
            </div>
          </form>
        </Card>

        <Card>
          {entries.length === 0 ? (
            <EmptyState title="Nu exista pontaj" description="Adauga prima inregistrare de timp." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
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
                        <p className="text-xs text-[#607468]">
                          {entry.endAt ? `Pana la ${formatDateTime(entry.endAt)}` : "Sesiune deschisa"}
                        </p>
                      </TD>
                      <TD>{entry.user.firstName} {entry.user.lastName}</TD>
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
                            <Button type="submit" size="sm">Aproba</Button>
                          </form>
                        ) : (
                          <span className="text-xs text-[#607468]">{entry.approvedAt ? formatDate(entry.approvedAt) : "-"}</span>
                        )}
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}
        </Card>
        <div className="flex items-center justify-between text-sm text-[#5f7265]">
          <span>Pagina {page} din {totalPages}</span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Link className="rounded-md border border-[#cfdcd2] px-3 py-1" href={`/pontaj?page=${page - 1}&status=${params.status || ""}&projectId=${params.projectId || ""}&from=${params.from || ""}&to=${params.to || ""}`}>Anterior</Link>
            ) : null}
            {page < totalPages ? (
              <Link className="rounded-md border border-[#cfdcd2] px-3 py-1" href={`/pontaj?page=${page + 1}&status=${params.status || ""}&projectId=${params.projectId || ""}&from=${params.from || ""}&to=${params.to || ""}`}>Urmator</Link>
            ) : null}
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
}
