import { WorkOrderStatus } from "@prisma/client";
import { Table as HeroTable } from "@heroui/react";
import Link from "next/link";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { EmptyState } from "@/src/components/ui/empty-state";
import { Input } from "@/src/components/ui/input";
import { PageHeader } from "@/src/components/ui/page-header";
import { ConfirmSubmitButton } from "@/src/components/forms/confirm-submit-button";
import { auth } from "@/src/lib/auth";
import { resolveAccessScope, workOrderScopeWhere } from "@/src/lib/access-scope";
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
    deletedAt: null,
    ...workOrderScopeWhere(userContext, scope),
    title: q ? { contains: q, mode: "insensitive" as const } : undefined,
    status: params.status || undefined,
    projectId:
      params.projectId && (scope.projectIds === null || scope.projectIds.includes(params.projectId))
        ? params.projectId
        : undefined,
  };

  const [projects, users, teams, workOrders, total] = await Promise.all([
    prisma.project.findMany({
      where: {
        deletedAt: null,
        ...(scope.projectIds === null ? {} : { id: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] } }),
      },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    prisma.user.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, firstName: true, lastName: true },
      orderBy: { firstName: "asc" },
    }),
    prisma.team.findMany({
      where: scope.teamId ? { deletedAt: null, id: scope.teamId } : { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.workOrder.findMany({
      where,
      select: {
        id: true,
        title: true,
        description: true,
        dueDate: true,
        priority: true,
        status: true,
        project: { select: { title: true } },
        responsible: { select: { firstName: true, lastName: true } },
        team: { select: { name: true } },
      },
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
        <PageHeader title="Lucrari si ordine de lucru" subtitle="Planificare, executie, control progres si urmarire blocaje" />

        <Card>
          <h2 className="text-lg font-semibold text-[#f0f5ff]">Creare ordin de lucru</h2>
          <WorkOrderCreateForm
            projects={projects.map((project) => ({ id: project.id, label: project.title }))}
            users={users.map((user) => ({ id: user.id, label: `${user.firstName} ${user.lastName}` }))}
            teams={teams.map((team) => ({ id: team.id, label: team.name }))}
          />
        </Card>

        <Card className="bulk-zone">
          <details>
            <summary>Actiuni bulk lucrari</summary>
            <form action={bulkWorkOrdersAction} className="mt-3 space-y-3">
            <div className="bulk-controls grid gap-2 md:grid-cols-3">
              <select name="operation" defaultValue="SET_STATUS">
                <option value="SET_STATUS">Actualizeaza status</option>
                <option value="DELETE">Sterge logic (CANCELED)</option>
              </select>
              <select name="status" defaultValue={WorkOrderStatus.IN_PROGRESS}>
                {Object.values(WorkOrderStatus).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <ConfirmSubmitButton text="Executa bulk" confirmMessage="Confirmi actiunea bulk pe lucrarile selectate?" />
            </div>
            <div className="max-h-36 overflow-y-auto rounded-xl border border-[color:var(--border)] p-3">
              <div className="grid gap-1 md:grid-cols-2">
                {workOrders.map((item) => (
                  <label key={item.id} className="flex items-center gap-2 text-sm text-[#dce7f9]">
                    <input type="checkbox" name="ids" value={item.id} className="h-4 w-4" />
                    <span>{item.title}</span>
                  </label>
                ))}
              </div>
            </div>
            </form>
          </details>
        </Card>

        <Card>
          <form className="mb-4 grid gap-3 md:grid-cols-4">
            <input type="hidden" name="page" value="1" />
            <Input name="q" placeholder="Cauta lucrare" defaultValue={q} />
            <select name="status" defaultValue={params.status || ""}>
              <option value="">Toate statusurile</option>
              {Object.values(WorkOrderStatus).map((status) => (
                <option key={status} value={status}>
                  {status}
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
            <div className="space-y-3 md:hidden">
              {workOrders.map((item) => (
                <div key={item.id} className="rounded-xl border border-[color:var(--border)] bg-[rgba(10,18,33,0.86)] p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={`/lucrari/${item.id}`} className="font-semibold text-[#c6dbff] hover:underline">
                        {item.title}
                      </Link>
                      <p className="text-xs text-[#95a9c4]">{item.project.title}</p>
                    </div>
                    <Badge tone={item.status === "DONE" ? "success" : item.status === "BLOCKED" ? "danger" : item.status === "IN_PROGRESS" ? "info" : "neutral"}>
                      {item.status}
                    </Badge>
                  </div>
                  <p className="mt-2 text-xs text-[#95a9c4]">{item.description?.slice(0, 120) || "-"}</p>
                  <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#d6e4f9]">
                    <p>Echipa: {item.team?.name || "-"}</p>
                    <p>Termen: {item.dueDate ? formatDate(item.dueDate) : "-"}</p>
                  </div>
                  <div className="mt-3 space-y-2">
                    <form action={updateWorkOrderStatus} className="grid grid-cols-[1fr_auto] gap-2">
                      <input type="hidden" name="id" value={item.id} />
                      <select name="status" defaultValue={item.status} className="h-10 rounded-md px-2 text-sm">
                        {Object.values(WorkOrderStatus).map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      <Button variant="ghost" size="sm" type="submit">
                        Salveaza
                      </Button>
                    </form>
                    <form action={deleteWorkOrder}>
                      <input type="hidden" name="id" value={item.id} />
                      <Button variant="destructive" size="sm" type="submit" className="w-full">
                        Sterge
                      </Button>
                    </form>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto rounded-xl border border-[color:var(--border)] md:block">
              <HeroTable aria-label="Tabel lucrari" className="bg-transparent">
                <HeroTable.Content>
                <HeroTable.Header>
                  <HeroTable.Column>TITLU</HeroTable.Column>
                  <HeroTable.Column>PROIECT</HeroTable.Column>
                  <HeroTable.Column>RESPONSABIL</HeroTable.Column>
                  <HeroTable.Column>ECHIPA</HeroTable.Column>
                  <HeroTable.Column>TERMEN</HeroTable.Column>
                  <HeroTable.Column>PRIORITATE</HeroTable.Column>
                  <HeroTable.Column>STATUS</HeroTable.Column>
                  <HeroTable.Column>ACTIUNI</HeroTable.Column>
                </HeroTable.Header>
                <HeroTable.Body>
                  {workOrders.map((item) => (
                    <HeroTable.Row key={item.id}>
                      <HeroTable.Cell>
                        <Link href={`/lucrari/${item.id}`} className="font-semibold text-[#c6dbff] hover:underline">
                          {item.title}
                        </Link>
                        <p className="text-xs text-[#95a9c4]">{item.description?.slice(0, 92) || "-"}</p>
                      </HeroTable.Cell>
                      <HeroTable.Cell>{item.project.title}</HeroTable.Cell>
                      <HeroTable.Cell>{item.responsible ? `${item.responsible.firstName} ${item.responsible.lastName}` : "Nealocat"}</HeroTable.Cell>
                      <HeroTable.Cell>{item.team?.name || "-"}</HeroTable.Cell>
                      <HeroTable.Cell>{item.dueDate ? formatDate(item.dueDate) : "-"}</HeroTable.Cell>
                      <HeroTable.Cell>
                        <Badge tone={item.priority === "CRITICAL" ? "danger" : item.priority === "HIGH" ? "warning" : "neutral"}>{item.priority}</Badge>
                      </HeroTable.Cell>
                      <HeroTable.Cell>
                        <Badge tone={item.status === "DONE" ? "success" : item.status === "BLOCKED" ? "danger" : item.status === "IN_PROGRESS" ? "info" : "neutral"}>{item.status}</Badge>
                      </HeroTable.Cell>
                      <HeroTable.Cell>
                        <div className="flex gap-2">
                          <form action={updateWorkOrderStatus}>
                            <input type="hidden" name="id" value={item.id} />
                            <select name="status" defaultValue={item.status} className="h-9 rounded-md px-2 text-xs">
                              {Object.values(WorkOrderStatus).map((status) => (
                                <option key={status} value={status}>
                                  {status}
                                </option>
                              ))}
                            </select>
                            <Button variant="ghost" size="sm" className="ml-1" type="submit">
                              Salveaza
                            </Button>
                          </form>
                          <form action={deleteWorkOrder}>
                            <input type="hidden" name="id" value={item.id} />
                            <Button variant="destructive" size="sm" type="submit">
                              Sterge
                            </Button>
                          </form>
                        </div>
                      </HeroTable.Cell>
                    </HeroTable.Row>
                  ))}
                </HeroTable.Body>
                </HeroTable.Content>
              </HeroTable>
            </div>
            </div>
          )}

          <div className="mt-4 flex items-center justify-between text-sm text-[#9cb0cb]">
            <span>
              Pagina {page} din {totalPages}
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <a className="rounded-lg border border-[color:var(--border)] px-3 py-1.5 hover:border-[#3f6499]" href={`/lucrari?page=${page - 1}&q=${encodeURIComponent(q)}&status=${params.status || ""}&projectId=${params.projectId || ""}`}>
                  Anterior
                </a>
              ) : null}
              {page < totalPages ? (
                <a className="rounded-lg border border-[color:var(--border)] px-3 py-1.5 hover:border-[#3f6499]" href={`/lucrari?page=${page + 1}&q=${encodeURIComponent(q)}&status=${params.status || ""}&projectId=${params.projectId || ""}`}>
                  Urmator
                </a>
              ) : null}
            </div>
          </div>
        </Card>
      </div>
    </PermissionGuard>
  );
}
