import { WorkOrderStatus } from "@prisma/client";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { EmptyState } from "@/src/components/ui/empty-state";
import { Input } from "@/src/components/ui/input";
import { PageHeader } from "@/src/components/ui/page-header";
import { TH, TD, Table } from "@/src/components/ui/table";
import { ConfirmSubmitButton } from "@/src/components/forms/confirm-submit-button";
import { formatDate } from "@/src/lib/utils";
import { prisma } from "@/src/lib/prisma";
import { bulkWorkOrdersAction, deleteWorkOrder, updateWorkOrderStatus } from "./actions";
import { WorkOrderCreateForm } from "./work-order-create-form";

export default async function WorkOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: WorkOrderStatus; page?: string; projectId?: string }>;
}) {
  const params = await searchParams;
  const q = params.q?.trim() || "";
  const page = Math.max(1, Number(params.page || "1"));
  const pageSize = 12;

  const where = {
    deletedAt: null,
    title: q ? { contains: q, mode: "insensitive" as const } : undefined,
    status: params.status || undefined,
    projectId: params.projectId || undefined,
  };

  const [projects, users, teams, workOrders, total] = await Promise.all([
    prisma.project.findMany({ where: { deletedAt: null }, orderBy: { title: "asc" } }),
    prisma.user.findMany({ where: { isActive: true, deletedAt: null }, orderBy: { firstName: "asc" } }),
    prisma.team.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
    prisma.workOrder.findMany({
      where,
      include: { project: true, responsible: true, team: true },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.workOrder.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <PermissionGuard resource="TASKS" action="VIEW">
      <div className="space-y-6">
        <PageHeader title="Lucrari si ordine de lucru" subtitle="Planifica, aloca, urmareste executia si aprobarea interventiilor" />

        <Card>
          <h2 className="text-lg font-extrabold">Creare ordin de lucru</h2>
          <WorkOrderCreateForm
            projects={projects.map((project) => ({ id: project.id, label: project.title }))}
            users={users.map((user) => ({ id: user.id, label: `${user.firstName} ${user.lastName}` }))}
            teams={teams.map((team) => ({ id: team.id, label: team.name }))}
          />
        </Card>

        <Card>
          <h2 className="text-lg font-extrabold">Actiuni bulk lucrari</h2>
          <form action={bulkWorkOrdersAction} className="mt-3 space-y-3">
            <div className="grid gap-2 md:grid-cols-3">
              <select name="operation" defaultValue="SET_STATUS" className="h-10 rounded-lg border border-[#cfddd3] px-3 text-sm">
                <option value="SET_STATUS">Actualizeaza status</option>
                <option value="DELETE">Sterge logic (CANCELED)</option>
              </select>
              <select name="status" defaultValue={WorkOrderStatus.IN_PROGRESS} className="h-10 rounded-lg border border-[#cfddd3] px-3 text-sm">
                {Object.values(WorkOrderStatus).map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <ConfirmSubmitButton text="Executa bulk" confirmMessage="Confirmi actiunea bulk pe lucrarile selectate?" />
            </div>
            <div className="max-h-36 overflow-y-auto rounded-lg border border-[#dce8df] p-2">
              <div className="grid gap-1 md:grid-cols-2">
                {workOrders.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="ids" value={item.id} />
                    <span>{item.title}</span>
                  </label>
                ))}
              </div>
            </div>
          </form>
        </Card>

        <Card>
          <form className="mb-4 grid gap-3 md:grid-cols-4">
            <input type="hidden" name="page" value="1" />
            <Input name="q" placeholder="Cauta lucrare" defaultValue={q} />
            <select name="status" defaultValue={params.status || ""} className="h-10 rounded-lg border border-[#cfddd3] px-3 text-sm">
              <option value="">Toate statusurile</option>
              {Object.values(WorkOrderStatus).map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <select name="projectId" defaultValue={params.projectId || ""} className="h-10 rounded-lg border border-[#cfddd3] px-3 text-sm">
              <option value="">Toate proiectele</option>
              {projects.map((project) => (
                <option key={project.id} value={project.id}>{project.title}</option>
              ))}
            </select>
            <Button type="submit" variant="secondary">Filtreaza</Button>
          </form>

          {workOrders.length === 0 ? (
            <EmptyState title="Nu exista lucrari" description="Adauga primul ordin de lucru pentru santier." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <TH>Titlu</TH>
                    <TH>Proiect</TH>
                    <TH>Responsabil</TH>
                    <TH>Echipa</TH>
                    <TH>Termen</TH>
                    <TH>Prioritate</TH>
                    <TH>Status</TH>
                    <TH>Actiuni</TH>
                  </tr>
                </thead>
                <tbody>
                  {workOrders.map((item) => (
                    <tr key={item.id}>
                      <TD>
                        <p className="font-semibold">{item.title}</p>
                        <p className="text-xs text-[#607468]">{item.description?.slice(0, 72) || "-"}</p>
                      </TD>
                      <TD>{item.project.title}</TD>
                      <TD>{item.responsible ? `${item.responsible.firstName} ${item.responsible.lastName}` : "Nealocat"}</TD>
                      <TD>{item.team?.name || "-"}</TD>
                      <TD>{item.dueDate ? formatDate(item.dueDate) : "-"}</TD>
                      <TD><Badge tone={item.priority === "CRITICAL" ? "danger" : item.priority === "HIGH" ? "warning" : "neutral"}>{item.priority}</Badge></TD>
                      <TD><Badge tone={item.status === "DONE" ? "success" : item.status === "BLOCKED" ? "danger" : item.status === "IN_PROGRESS" ? "info" : "neutral"}>{item.status}</Badge></TD>
                      <TD>
                        <div className="flex gap-2">
                          <form action={updateWorkOrderStatus}>
                            <input type="hidden" name="id" value={item.id} />
                            <select name="status" defaultValue={item.status} className="h-9 rounded-md border border-[#cfdcd2] px-2 text-xs">
                              {Object.values(WorkOrderStatus).map((status) => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>
                            <Button variant="ghost" size="sm" className="ml-1" type="submit">Salveaza</Button>
                          </form>
                          <form action={deleteWorkOrder}>
                            <input type="hidden" name="id" value={item.id} />
                            <Button variant="destructive" size="sm" type="submit">Sterge</Button>
                          </form>
                        </div>
                      </TD>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between text-sm text-[#5f7265]">
            <span>Pagina {page} din {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 ? (
                <a className="rounded-md border border-[#cfdcd2] px-3 py-1" href={`/lucrari?page=${page - 1}&q=${encodeURIComponent(q)}&status=${params.status || ""}&projectId=${params.projectId || ""}`}>Anterior</a>
              ) : null}
              {page < totalPages ? (
                <a className="rounded-md border border-[#cfdcd2] px-3 py-1" href={`/lucrari?page=${page + 1}&q=${encodeURIComponent(q)}&status=${params.status || ""}&projectId=${params.projectId || ""}`}>Urmator</a>
              ) : null}
            </div>
          </div>
        </Card>
      </div>
    </PermissionGuard>
  );
}
