import { ProjectStatus } from "@prisma/client";
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
import { projectScopeWhere, resolveAccessScope } from "@/src/lib/access-scope";
import { formatCurrency, formatDate } from "@/src/lib/utils";
import { prisma } from "@/src/lib/prisma";
import { bulkProjectsAction, deleteProject, updateProjectStatus } from "./actions";
import { ProjectCreateForm } from "./project-create-form";

function mapStatus(status: ProjectStatus) {
  switch (status) {
    case "ACTIVE":
      return { label: "Activ", tone: "success" as const };
    case "PLANNED":
      return { label: "Planificat", tone: "info" as const };
    case "BLOCKED":
      return { label: "Blocat", tone: "danger" as const };
    case "COMPLETED":
      return { label: "Finalizat", tone: "neutral" as const };
    case "CANCELED":
      return { label: "Anulat", tone: "warning" as const };
    default:
      return { label: "Draft", tone: "neutral" as const };
  }
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; status?: ProjectStatus; page?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() || "";
  const statusFilter = params.status;
  const page = Math.max(1, Number(params.page || "1"));
  const pageSize = 10;
  const session = await auth();
  const scope = session?.user
    ? await resolveAccessScope({
        id: session.user.id,
        email: session.user.email,
        roleKeys: session.user.roleKeys || [],
      })
    : { projectIds: null, teamId: null };
  const where = {
    deletedAt: null,
    ...projectScopeWhere(scope.projectIds),
    title: query ? { contains: query, mode: "insensitive" as const } : undefined,
    status: statusFilter || undefined,
  };

  const [projects, total, clients] = await Promise.all([
    prisma.project.findMany({
      where,
      include: {
        client: true,
        manager: true,
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.project.count({ where }),
    prisma.client.findMany({
      where:
        scope.projectIds === null
          ? { deletedAt: null }
          : { deletedAt: null, projects: { some: { id: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] } } } },
      orderBy: { name: "asc" },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <PermissionGuard resource="PROJECTS" action="VIEW">
      <div className="space-y-6">
        <PageHeader title="Proiecte" subtitle="Control complet pentru status, buget, progres si risc operational" />

        <Card>
          <h2 className="text-lg font-semibold text-[#f0f5ff]">Proiect nou</h2>
          <ProjectCreateForm clients={clients} />
        </Card>

        <Card className="bulk-zone">
          <details>
            <summary>Actiuni bulk proiecte</summary>
            <form action={bulkProjectsAction} className="mt-3 space-y-3">
            <div className="bulk-controls grid gap-2 md:grid-cols-3">
              <select name="operation" defaultValue="SET_STATUS">
                <option value="SET_STATUS">Actualizeaza status</option>
                <option value="ARCHIVE">Arhiveaza (soft delete)</option>
              </select>
              <select name="status" defaultValue={ProjectStatus.ACTIVE}>
                {Object.values(ProjectStatus).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <ConfirmSubmitButton text="Executa bulk" confirmMessage="Confirmi executia actiunii bulk pe proiectele selectate?" />
            </div>
            <div className="max-h-36 overflow-y-auto rounded-xl border border-[color:var(--border)] p-3">
              <div className="grid gap-1 md:grid-cols-2">
                {projects.map((project) => (
                  <label key={project.id} className="flex items-center gap-2 text-sm text-[#d9e5f8]">
                    <input type="checkbox" name="ids" value={project.id} className="h-4 w-4" />
                    <span>
                      {project.code} - {project.title}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            </form>
          </details>
        </Card>

        <Card>
          <form className="mb-4 grid gap-3 md:grid-cols-3">
            <Input name="q" placeholder="Filtru dupa nume proiect" defaultValue={query} />
            <input type="hidden" name="page" value="1" />
            <select name="status" defaultValue={statusFilter || ""}>
              <option value="">Toate statusurile</option>
              {Object.values(ProjectStatus).map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary">
              Aplica filtre
            </Button>
          </form>

          {projects.length === 0 ? (
            <EmptyState title="Nu exista proiecte" description="Adauga primul proiect pentru a incepe planificarea." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-[color:var(--border)]">
              <HeroTable aria-label="Tabel proiecte" className="bg-transparent">
                <HeroTable.Content>
                <HeroTable.Header>
                  <HeroTable.Column>COD</HeroTable.Column>
                  <HeroTable.Column>PROIECT</HeroTable.Column>
                  <HeroTable.Column>CLIENT</HeroTable.Column>
                  <HeroTable.Column>MANAGER</HeroTable.Column>
                  <HeroTable.Column>BUGET</HeroTable.Column>
                  <HeroTable.Column>PROGRES</HeroTable.Column>
                  <HeroTable.Column>STATUS</HeroTable.Column>
                  <HeroTable.Column>ACTIUNI</HeroTable.Column>
                </HeroTable.Header>
                <HeroTable.Body>
                  {projects.map((project) => {
                    const status = mapStatus(project.status);
                    return (
                      <HeroTable.Row key={project.id}>
                        <HeroTable.Cell>{project.code}</HeroTable.Cell>
                        <HeroTable.Cell>
                          <Link href={`/proiecte/${project.id}`} className="font-semibold text-[#b9d4ff] hover:text-[#d9e7ff] hover:underline">
                            {project.title}
                          </Link>
                          <p className="text-xs text-[#95a9c4]">{project.siteAddress}</p>
                          <p className="text-xs text-[#95a9c4]">
                            {project.startDate ? formatDate(project.startDate) : "-"} - {project.endDate ? formatDate(project.endDate) : "-"}
                          </p>
                        </HeroTable.Cell>
                        <HeroTable.Cell>{project.client.name}</HeroTable.Cell>
                        <HeroTable.Cell>{project.manager ? `${project.manager.firstName} ${project.manager.lastName}` : "Nealocat"}</HeroTable.Cell>
                        <HeroTable.Cell>
                          <p>{formatCurrency(project.estimatedBudget?.toString() || 0)}</p>
                          <p className="text-xs text-[#95a9c4]">Contract: {formatCurrency(project.contractValue?.toString() || 0)}</p>
                        </HeroTable.Cell>
                        <HeroTable.Cell>{project.progressPercent}%</HeroTable.Cell>
                        <HeroTable.Cell>
                          <Badge tone={status.tone}>{status.label}</Badge>
                        </HeroTable.Cell>
                        <HeroTable.Cell>
                          <div className="flex gap-2">
                            <form action={updateProjectStatus}>
                              <input type="hidden" name="id" value={project.id} />
                              <select name="status" defaultValue={project.status} className="h-9 rounded-md px-2 text-xs">
                                {Object.values(ProjectStatus).map((st) => (
                                  <option key={st} value={st}>
                                    {st}
                                  </option>
                                ))}
                              </select>
                              <Button size="sm" variant="ghost" type="submit" className="ml-1">
                                Salveaza
                              </Button>
                            </form>
                            <form action={deleteProject}>
                              <input type="hidden" name="id" value={project.id} />
                              <Button size="sm" variant="destructive" type="submit">
                                Sterge
                              </Button>
                            </form>
                          </div>
                        </HeroTable.Cell>
                      </HeroTable.Row>
                    );
                  })}
                </HeroTable.Body>
                </HeroTable.Content>
              </HeroTable>
            </div>
          )}
          <div className="mt-4 flex items-center justify-between text-sm text-[#9cb0cb]">
            <span>
              Pagina {page} din {totalPages}
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={`/proiecte?page=${page - 1}&q=${encodeURIComponent(query)}&status=${statusFilter || ""}`}
                  className="rounded-lg border border-[color:var(--border)] px-3 py-1.5 hover:border-[#3f6499]"
                >
                  Anterior
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link
                  href={`/proiecte?page=${page + 1}&q=${encodeURIComponent(query)}&status=${statusFilter || ""}`}
                  className="rounded-lg border border-[color:var(--border)] px-3 py-1.5 hover:border-[#3f6499]"
                >
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
