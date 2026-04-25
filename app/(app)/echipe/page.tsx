import Link from "next/link";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { ConfirmSubmitButton } from "@/src/components/forms/confirm-submit-button";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { EmptyState } from "@/src/components/ui/empty-state";
import { Input } from "@/src/components/ui/input";
import { PageHeader } from "@/src/components/ui/page-header";
import { auth } from "@/src/lib/auth";
import { buildListHref, parseEnumParam, parsePositiveIntParam, resolvePagination } from "@/src/lib/query-params";
import { hasPermission } from "@/src/lib/rbac";
import { prisma } from "@/src/lib/prisma";
import { archiveTeamAction, restoreTeamAction, updateTeamAction, updateTeamMembersAction } from "./actions";
import { TeamCreateForm } from "./team-create-form";

const statusOptions = ["active", "inactive", "archived", "all"] as const;
type TeamStatusFilter = (typeof statusOptions)[number];

const statusLabels: Record<TeamStatusFilter, string> = {
  active: "Active",
  inactive: "Inactive",
  archived: "Arhivate",
  all: "Toate",
};

function buildEchipeHref({
  page,
  q,
  status,
  dialog,
}: {
  page?: number;
  q?: string;
  status?: TeamStatusFilter;
  dialog?: "create";
}) {
  return buildListHref("/echipe", {
    page,
    q,
    status: status && status !== "active" ? status : undefined,
    dialog,
  });
}

export default async function EchipePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string; dialog?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() || "";
  const statusFilter = parseEnumParam(params.status, statusOptions) || "active";
  const page = parsePositiveIntParam(params.page);
  const pageSize = 12;
  const createDialogOpen = params.dialog === "create";
  const session = await auth();
  const userContext = {
    id: session?.user?.id || "",
    email: session?.user?.email || null,
    roleKeys: session?.user?.roleKeys || [],
  };
  const canCreate = hasPermission(userContext.roleKeys, "TEAMS", "CREATE", userContext.email);
  const canUpdate = hasPermission(userContext.roleKeys, "TEAMS", "UPDATE", userContext.email);
  const canDelete = hasPermission(userContext.roleKeys, "TEAMS", "DELETE", userContext.email);

  const where = {
    ...(statusFilter === "active" ? { deletedAt: null, isActive: true } : {}),
    ...(statusFilter === "inactive" ? { deletedAt: null, isActive: false } : {}),
    ...(statusFilter === "archived" ? { deletedAt: { not: null } } : {}),
    ...(query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" as const } },
            { code: { contains: query, mode: "insensitive" as const } },
            { region: { contains: query, mode: "insensitive" as const } },
            { leadUser: { firstName: { contains: query, mode: "insensitive" as const } } },
            { leadUser: { lastName: { contains: query, mode: "insensitive" as const } } },
          ],
        }
      : {}),
  };

  const [totalTeams, activeTeams, inactiveTeams, totalWorkers, teamsWithWorkOrders, users, workerProfiles] = await Promise.all([
    prisma.team.count({ where }),
    prisma.team.count({ where: { deletedAt: null, isActive: true } }),
    prisma.team.count({ where: { deletedAt: null, isActive: false } }),
    prisma.workerProfile.count({ where: { deletedAt: null } }),
    prisma.workOrder.groupBy({
      by: ["teamId"],
      where: { teamId: { not: null }, deletedAt: null },
      _count: { _all: true },
    }),
    prisma.user.findMany({
      where: { isActive: true, deletedAt: null },
      select: { id: true, firstName: true, lastName: true, email: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }, { id: "asc" }],
    }),
    prisma.workerProfile.findMany({
      where: { deletedAt: null },
      select: {
        id: true,
        positionTitle: true,
        teamId: true,
        team: { select: { name: true } },
        user: { select: { firstName: true, lastName: true, email: true } },
      },
      orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }, { id: "asc" }],
    }),
  ]);
  const workOrderCountByTeamId = new Map(
    teamsWithWorkOrders.filter((item) => item.teamId).map((item) => [item.teamId as string, item._count._all]),
  );
  const { totalPages, currentPage, skip, take } = resolvePagination({
    page,
    totalItems: totalTeams,
    pageSize,
  });
  const teams = await prisma.team.findMany({
    where,
    select: {
      id: true,
      name: true,
      code: true,
      region: true,
      isActive: true,
      deletedAt: true,
      leadUserId: true,
      leadUser: { select: { firstName: true, lastName: true } },
      workers: {
        where: { deletedAt: null },
        select: {
          id: true,
          positionTitle: true,
          user: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ user: { firstName: "asc" } }, { user: { lastName: "asc" } }],
      },
    },
    orderBy: [{ deletedAt: "asc" }, { name: "asc" }, { id: "asc" }],
    skip,
    take,
  });

  const createHref = buildEchipeHref({ page: currentPage, q: query, status: statusFilter, dialog: "create" });
  const closeHref = buildEchipeHref({ page: currentPage, q: query, status: statusFilter });
  const prevHref = currentPage > 1 ? buildEchipeHref({ page: currentPage - 1, q: query, status: statusFilter, dialog: createDialogOpen ? "create" : undefined }) : null;
  const nextHref = currentPage < totalPages ? buildEchipeHref({ page: currentPage + 1, q: query, status: statusFilter, dialog: createDialogOpen ? "create" : undefined }) : null;
  const hasFilters = Boolean(query || statusFilter !== "active");
  const userOptions = users.map((user) => ({
    id: user.id,
    label: `${user.firstName} ${user.lastName}${user.email ? ` (${user.email})` : ""}`,
  }));
  const workerOptions = workerProfiles.map((profile) => ({
    id: profile.id,
    teamId: profile.teamId,
    teamName: profile.team?.name || null,
    label: `${profile.user.firstName} ${profile.user.lastName} - ${profile.positionTitle}${profile.user.email ? ` (${profile.user.email})` : ""}`,
  }));

  return (
    <PermissionGuard resource="TEAMS" action="VIEW">
      <div className="space-y-6">
        <PageHeader
          title="Echipe"
          subtitle="Creeaza echipe operationale, seteaza responsabilul si controleaza ce grupuri pot fi alocate pe lucrari."
          actions={
            canCreate ? (
              <Link href={createHref}>
                <Button>Adauga echipa</Button>
              </Link>
            ) : null
          }
        />

        {createDialogOpen && canCreate ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(7,12,18,0.72)] p-3 sm:items-center sm:p-5" role="presentation">
            <div className="w-full max-w-3xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--shadow-panel)] sm:p-5">
              <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] pb-3">
                <div>
                  <p className="text-base font-semibold text-[var(--foreground)]">Creare echipa</p>
                  <p className="mt-1 text-sm text-[var(--muted)]">Echipa noua apare imediat in dropdown-ul de la lucrari.</p>
                </div>
                <Link href={closeHref}>
                  <Button variant="ghost" size="sm">Inchide</Button>
                </Link>
              </div>
              <div className="pt-4">
                <TeamCreateForm users={userOptions} workers={workerOptions} />
              </div>
            </div>
          </div>
        ) : null}

        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{totalTeams} echipe gasite</Badge>
            {hasFilters ? <Badge tone="info">Filtru activ</Badge> : <Badge tone="success">Active pentru lucrari</Badge>}
          </div>
          <form method="get" action="/echipe" className="mt-4 grid gap-3 md:grid-cols-[minmax(0,1fr)_220px_auto] md:items-center">
            <input type="hidden" name="page" value="1" />
            <Input name="q" defaultValue={query} placeholder="Cauta dupa nume, cod, regiune sau sef echipa" />
            <select
              name="status"
              defaultValue={statusFilter}
              className="h-11 rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 text-sm text-[var(--foreground)]"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>
                  {statusLabels[status]}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary">Filtreaza</Button>
          </form>
        </Card>

        <section className="grid gap-3 md:grid-cols-3">
          <Card>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Active</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{activeTeams}</p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Inactive</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{inactiveTeams}</p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Membri disponibili</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{totalWorkers}</p>
          </Card>
        </section>

        {teams.length === 0 ? (
          <EmptyState
            title={hasFilters ? "Nu exista echipe pentru filtrele curente" : "Nu exista echipe active"}
            description={hasFilters ? "Schimba filtrul sau cautarea." : "Creeaza prima echipa pentru a o putea trimite la lucrari."}
          />
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {teams.map((team) => {
            const workOrdersCount = workOrderCountByTeamId.get(team.id) || 0;
            const isArchived = Boolean(team.deletedAt);
            return (
              <Card key={team.id} className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-base font-semibold text-[var(--foreground)]">{team.name}</p>
                    <p className="mt-1 text-xs text-[var(--muted)]">{team.code}</p>
                  </div>
                  <Badge tone={isArchived ? "warning" : team.isActive ? "success" : "neutral"}>
                    {isArchived ? "Arhivat" : team.isActive ? "Activ" : "Inactiv"}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-[var(--muted)]">
                  <p>Regiune: {team.region || "-"}</p>
                  <p>Lucrari active: {workOrdersCount}</p>
                  <p className="col-span-2">Sef echipa: {team.leadUser ? `${team.leadUser.firstName} ${team.leadUser.lastName}` : "-"}</p>
                  <p className="col-span-2">Membri: {team.workers.length}</p>
                </div>

                {team.workers.length ? (
                  <div className="rounded-xl border border-[var(--border)] bg-[rgba(10,18,28,0.35)] p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Membri echipa</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {team.workers.map((worker) => (
                        <Badge key={worker.id} tone="info" className="normal-case tracking-normal">
                          {worker.user.firstName} {worker.user.lastName} - {worker.positionTitle}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ) : null}

                {canUpdate && !isArchived ? (
                  <form action={updateTeamAction} className="grid gap-2 border-t border-[var(--border)] pt-3">
                    <input type="hidden" name="id" value={team.id} />
                    <Input name="name" defaultValue={team.name} />
                    <Input name="code" defaultValue={team.code} />
                    <Input name="region" defaultValue={team.region || ""} />
                    <select name="leadUserId" defaultValue={team.leadUserId || ""} className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 text-sm text-[var(--foreground)]">
                      <option value="">Fara sef echipa</option>
                      {userOptions.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.label}
                        </option>
                      ))}
                    </select>
                    <select name="isActive" defaultValue={team.isActive ? "true" : "false"} className="h-10 rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 text-sm text-[var(--foreground)]">
                      <option value="true">Activa pentru lucrari</option>
                      <option value="false">Inactiva</option>
                    </select>
                    <Button type="submit" size="sm">Salveaza echipa</Button>
                  </form>
                ) : null}

                {canUpdate && !isArchived ? (
                  <details className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-3">
                    <summary className="cursor-pointer text-sm font-semibold text-[var(--foreground)]">Gestioneaza membri</summary>
                    <form action={updateTeamMembersAction} className="mt-3 grid gap-3">
                      <input type="hidden" name="id" value={team.id} />
                      {workerOptions.length ? (
                        <div className="grid max-h-64 gap-2 overflow-y-auto pr-1">
                          {workerOptions.map((worker) => {
                            const checked = worker.teamId === team.id;
                            return (
                              <label key={worker.id} className="flex items-start gap-2 rounded-lg border border-[var(--border)] bg-[rgba(10,18,28,0.42)] px-3 py-2 text-sm text-[var(--foreground)]">
                                <input
                                  type="checkbox"
                                  name="memberIds"
                                  value={worker.id}
                                  defaultChecked={checked}
                                  className="mt-1 h-4 w-4 accent-[#8dc1f5]"
                                />
                                <span className="min-w-0">
                                  <span className="block truncate">{worker.label}</span>
                                  <span className="block text-xs text-[var(--muted)]">
                                    {checked ? "Membru aici" : worker.teamName ? `Acum in ${worker.teamName}` : "Fara echipa"}
                                  </span>
                                </span>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <p className="text-sm text-[var(--muted)]">Nu exista profiluri de muncitor disponibile.</p>
                      )}
                      <Button type="submit" size="sm" variant="secondary">Salveaza membri</Button>
                    </form>
                  </details>
                ) : null}

                <div className="flex flex-wrap gap-2">
                  {canDelete && !isArchived ? (
                    <form action={archiveTeamAction}>
                      <input type="hidden" name="id" value={team.id} />
                      <ConfirmSubmitButton text="Arhiveaza" confirmMessage={`Confirmi arhivarea echipei ${team.name}?`} variant="destructive" />
                    </form>
                  ) : null}
                  {canUpdate && isArchived ? (
                    <form action={restoreTeamAction}>
                      <input type="hidden" name="id" value={team.id} />
                      <ConfirmSubmitButton text="Restaureaza" confirmMessage={`Restaurezi echipa ${team.name}?`} variant="secondary" />
                    </form>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4 text-sm text-[var(--muted)]">
          <span>
            Pagina {currentPage} din {totalPages}
          </span>
          <div className="flex gap-2">
            {prevHref ? (
              <Link href={prevHref}>
                <Button variant="secondary" size="sm">Inapoi</Button>
              </Link>
            ) : null}
            {nextHref ? (
              <Link href={nextHref}>
                <Button variant="secondary" size="sm">Inainte</Button>
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
}
