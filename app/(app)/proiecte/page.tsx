import { ProjectStatus } from "@prisma/client";
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
import { auth } from "@/src/lib/auth";
import { projectScopeWhere, resolveAccessScope } from "@/src/lib/access-scope";
import { parseEnumParam, parsePositiveIntParam } from "@/src/lib/query-params";
import { hasPermission } from "@/src/lib/rbac";
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
  searchParams: Promise<{ q?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() || "";
  const statusFilter = parseEnumParam(params.status, Object.values(ProjectStatus));
  const page = parsePositiveIntParam(params.page);
  const pageSize = 10;
  const session = await auth();
  const scope = session?.user
    ? await resolveAccessScope({
        id: session.user.id,
        email: session.user.email,
        roleKeys: session.user.roleKeys || [],
      })
    : { projectIds: null, teamId: null };
  const roleKeys = session?.user?.roleKeys || [];
  const userEmail = session?.user?.email || null;
  const canCreate = hasPermission(roleKeys, "PROJECTS", "CREATE", userEmail);
  const canUpdate = hasPermission(roleKeys, "PROJECTS", "UPDATE", userEmail);
  const canDelete = hasPermission(roleKeys, "PROJECTS", "DELETE", userEmail);
  const where = {
    deletedAt: null,
    ...projectScopeWhere(scope.projectIds),
    title: query ? { contains: query, mode: "insensitive" as const } : undefined,
    status: statusFilter || undefined,
  };

  const [projects, total, clients] = await Promise.all([
    prisma.project.findMany({
      where,
      select: {
        id: true,
        code: true,
        title: true,
        siteAddress: true,
        startDate: true,
        endDate: true,
        estimatedBudget: true,
        contractValue: true,
        progressPercent: true,
        status: true,
        client: { select: { name: true } },
        manager: { select: { firstName: true, lastName: true } },
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
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <PermissionGuard resource="PROJECTS" action="VIEW">
      <div className="space-y-6">
        <PageHeader title="Proiecte" subtitle="Portofoliu executie, costuri, status contractual si risc operational" />

        {canCreate ? (
          <Card>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Create</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Proiect nou</h2>
            <ProjectCreateForm clients={clients} />
          </Card>
        ) : null}

        {canUpdate || canDelete ? (
          <Card className="bulk-zone">
            <details>
              <summary>Actiuni bulk proiecte</summary>
              <form action={bulkProjectsAction} className="mt-3 space-y-3">
              <div className="bulk-controls grid gap-2 md:grid-cols-3">
                <select
                  name="operation"
                  defaultValue={canUpdate ? "SET_STATUS" : "ARCHIVE"}
                >
                  {canUpdate ? <option value="SET_STATUS">Actualizeaza status</option> : null}
                  {canDelete ? <option value="ARCHIVE">Arhiveaza (soft delete)</option> : null}
                </select>
                <select name="status" defaultValue={ProjectStatus.ACTIVE} disabled={!canUpdate}>
                  {Object.values(ProjectStatus).map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
                <ConfirmSubmitButton text="Executa bulk" confirmMessage="Confirmi executia actiunii bulk pe proiectele selectate?" />
              </div>
              <div className="max-h-36 overflow-y-auto rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3">
                <div className="grid gap-1 md:grid-cols-2">
                  {projects.map((project) => (
                    <label key={project.id} className="flex items-center gap-2 text-sm text-[#d9e8fb]">
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
        ) : null}

        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Filters</p>
          <form className="mb-4 mt-2 grid gap-3 md:grid-cols-3">
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
            <div>
            <div className="space-y-3 md:hidden">
              {projects.map((project) => {
                const status = mapStatus(project.status);
                return (
                  <div key={project.id} className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link href={`/proiecte/${project.id}`} className="font-semibold text-[var(--muted-strong)] hover:underline">
                          {project.title}
                        </Link>
                        <p className="text-xs text-[#9fb9d7]">{project.code}</p>
                      </div>
                      <Badge tone={status.tone}>{status.label}</Badge>
                    </div>
                    <p className="mt-2 text-xs text-[var(--muted)]">{project.client.name}</p>
                    <p className="text-xs text-[var(--muted)]">{project.manager ? `${project.manager.firstName} ${project.manager.lastName}` : "Manager nealocat"}</p>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#cfe0f6]">
                      <p>Buget: {formatCurrency(project.estimatedBudget?.toString() || 0)}</p>
                      <p>Progres: {project.progressPercent}%</p>
                    </div>
                    {canUpdate || canDelete ? (
                      <div className="mt-3 space-y-2">
                        {canUpdate ? (
                          <form action={updateProjectStatus} className="grid grid-cols-[1fr_auto] gap-2">
                            <input type="hidden" name="id" value={project.id} />
                            <select name="status" defaultValue={project.status} className="h-10 rounded-md px-2 text-sm">
                              {Object.values(ProjectStatus).map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                            <Button size="sm" variant="ghost" type="submit">
                              Salveaza
                            </Button>
                          </form>
                        ) : null}
                        {canDelete ? (
                          <form action={deleteProject}>
                            <input type="hidden" name="id" value={project.id} />
                            <Button size="sm" variant="destructive" type="submit" className="w-full">
                              Sterge
                            </Button>
                          </form>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] md:block">
              <Table>
                <thead>
                  <tr>
                    <TH>COD</TH>
                    <TH>PROIECT</TH>
                    <TH>CLIENT</TH>
                    <TH>MANAGER</TH>
                    <TH>BUGET</TH>
                    <TH>PROGRES</TH>
                    <TH>STATUS</TH>
                    <TH>ACTIUNI</TH>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => {
                    const status = mapStatus(project.status);
                    return (
                      <tr key={project.id}>
                        <TD>{project.code}</TD>
                        <TD>
                          <Link href={`/proiecte/${project.id}`} className="font-semibold text-[#d4e8ff] hover:text-[#f0f8ff] hover:underline">
                            {project.title}
                          </Link>
                          <p className="text-xs text-[var(--muted)]">{project.siteAddress}</p>
                          <p className="text-xs text-[var(--muted)]">
                            {project.startDate ? formatDate(project.startDate) : "-"} - {project.endDate ? formatDate(project.endDate) : "-"}
                          </p>
                        </TD>
                        <TD>{project.client.name}</TD>
                        <TD>{project.manager ? `${project.manager.firstName} ${project.manager.lastName}` : "Nealocat"}</TD>
                        <TD>
                          <p>{formatCurrency(project.estimatedBudget?.toString() || 0)}</p>
                          <p className="text-xs text-[var(--muted)]">Contract: {formatCurrency(project.contractValue?.toString() || 0)}</p>
                        </TD>
                        <TD>{project.progressPercent}%</TD>
                        <TD>
                          <Badge tone={status.tone}>{status.label}</Badge>
                        </TD>
                        <TD>
                          {canUpdate || canDelete ? (
                            <div className="flex gap-2">
                              {canUpdate ? (
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
                              ) : null}
                              {canDelete ? (
                                <form action={deleteProject}>
                                  <input type="hidden" name="id" value={project.id} />
                                  <Button size="sm" variant="destructive" type="submit">
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
                    );
                  })}
                </tbody>
              </Table>
            </div>
            </div>
          )}
          <div className="mt-5 flex flex-col items-center justify-between gap-3 border-t border-[var(--border)]/60 pt-4 text-sm text-[var(--muted)] sm:flex-row">
            <span>
              Pagina {page} din {totalPages}
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={`/proiecte?page=${page - 1}&q=${encodeURIComponent(query)}&status=${statusFilter || ""}`}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 hover:border-[var(--border-strong)]"
                >
                  Anterior
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link
                  href={`/proiecte?page=${page + 1}&q=${encodeURIComponent(query)}&status=${statusFilter || ""}`}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 hover:border-[var(--border-strong)]"
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
