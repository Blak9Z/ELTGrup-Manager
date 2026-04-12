import { ProjectStatus } from "@prisma/client";
import Link from "next/link";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { EmptyState } from "@/src/components/ui/empty-state";
import { Input } from "@/src/components/ui/input";
import { PageHeader } from "@/src/components/ui/page-header";
import { TH, TD, Table } from "@/src/components/ui/table";
import { ConfirmSubmitButton } from "@/src/components/forms/confirm-submit-button";
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
  const where = {
    deletedAt: null,
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
    prisma.client.findMany({ where: { deletedAt: null }, orderBy: { name: "asc" } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  return (
    <PermissionGuard resource="PROJECTS" action="VIEW">
      <div className="space-y-6">
        <PageHeader
          title="Proiecte"
          subtitle="Management complet lucrari: status, buget, manager, progres, riscuri"
        />

        <Card>
          <h2 className="text-lg font-extrabold">Adauga proiect nou</h2>
          <ProjectCreateForm clients={clients} />
        </Card>

        <Card>
          <h2 className="text-lg font-extrabold">Actiuni bulk proiecte</h2>
          <form action={bulkProjectsAction} className="mt-3 space-y-3">
            <div className="grid gap-2 md:grid-cols-3">
              <select name="operation" defaultValue="SET_STATUS" className="h-10 rounded-lg border border-[#cfddd3] px-3 text-sm">
                <option value="SET_STATUS">Actualizeaza status</option>
                <option value="ARCHIVE">Arhiveaza (soft delete)</option>
              </select>
              <select name="status" defaultValue={ProjectStatus.ACTIVE} className="h-10 rounded-lg border border-[#cfddd3] px-3 text-sm">
                {Object.values(ProjectStatus).map((status) => (
                  <option key={status} value={status}>{status}</option>
                ))}
              </select>
              <ConfirmSubmitButton text="Executa bulk" confirmMessage="Confirmi executia actiunii bulk pe proiectele selectate?" />
            </div>
            <div className="max-h-36 overflow-y-auto rounded-lg border border-[#dce8df] p-2">
              <div className="grid gap-1 md:grid-cols-2">
                {projects.map((project) => (
                  <label key={project.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="ids" value={project.id} />
                    <span>{project.code} - {project.title}</span>
                  </label>
                ))}
              </div>
            </div>
          </form>
        </Card>

        <Card>
          <form className="mb-4 grid gap-3 md:grid-cols-3">
            <Input name="q" placeholder="Filtru dupa nume proiect" defaultValue={query} />
            <input type="hidden" name="page" value="1" />
            <select name="status" defaultValue={statusFilter || ""} className="h-10 rounded-lg border border-[#cfddd3] px-3 text-sm">
              <option value="">Toate statusurile</option>
              {Object.values(ProjectStatus).map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <Button type="submit" variant="secondary">Aplica filtre</Button>
          </form>

          {projects.length === 0 ? (
            <EmptyState title="Nu exista proiecte" description="Adauga primul proiect pentru a incepe planificarea." />
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <thead>
                  <tr>
                    <TH>Cod</TH>
                    <TH>Proiect</TH>
                    <TH>Client</TH>
                    <TH>Manager</TH>
                    <TH>Buget</TH>
                    <TH>Progres</TH>
                    <TH>Status</TH>
                    <TH>Actiuni</TH>
                  </tr>
                </thead>
                <tbody>
                  {projects.map((project) => {
                    const status = mapStatus(project.status);
                    return (
                      <tr key={project.id}>
                        <TD>{project.code}</TD>
                        <TD>
                          <Link href={`/proiecte/${project.id}`} className="font-semibold text-[#0f5d39] hover:underline">
                            {project.title}
                          </Link>
                          <p className="text-xs text-[#617468]">{project.siteAddress}</p>
                          <p className="text-xs text-[#617468]">{project.startDate ? formatDate(project.startDate) : "-"} - {project.endDate ? formatDate(project.endDate) : "-"}</p>
                        </TD>
                        <TD>{project.client.name}</TD>
                        <TD>{project.manager ? `${project.manager.firstName} ${project.manager.lastName}` : "Nealocat"}</TD>
                        <TD>
                          <p>{formatCurrency(project.estimatedBudget?.toString() || 0)}</p>
                          <p className="text-xs text-[#617468]">Contract: {formatCurrency(project.contractValue?.toString() || 0)}</p>
                        </TD>
                        <TD>{project.progressPercent}%</TD>
                        <TD><Badge tone={status.tone}>{status.label}</Badge></TD>
                        <TD>
                          <div className="flex gap-2">
                            <form action={updateProjectStatus}>
                              <input type="hidden" name="id" value={project.id} />
                              <select name="status" defaultValue={project.status} className="h-9 rounded-md border border-[#cfdcd2] px-2 text-xs">
                                {Object.values(ProjectStatus).map((st) => (
                                  <option key={st} value={st}>{st}</option>
                                ))}
                              </select>
                              <Button size="sm" variant="ghost" type="submit" className="ml-1">Salveaza</Button>
                            </form>
                            <form action={deleteProject}>
                              <input type="hidden" name="id" value={project.id} />
                              <Button size="sm" variant="destructive" type="submit">Sterge</Button>
                            </form>
                          </div>
                        </TD>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          )}
          <div className="mt-4 flex items-center justify-between text-sm text-[#5f7265]">
            <span>Pagina {page} din {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  href={`/proiecte?page=${page - 1}&q=${encodeURIComponent(query)}&status=${statusFilter || ""}`}
                  className="rounded-md border border-[#cfdcd2] px-3 py-1"
                >
                  Anterior
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link
                  href={`/proiecte?page=${page + 1}&q=${encodeURIComponent(query)}&status=${statusFilter || ""}`}
                  className="rounded-md border border-[#cfdcd2] px-3 py-1"
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
