import { AssignmentStatus, Prisma, SubcontractorApprovalStatus } from "@prisma/client";
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
import { resolveAccessScope, subcontractorScopeWhere } from "@/src/lib/access-scope";
import { buildListHref, parseEnumParam, parsePositiveIntParam, resolvePagination } from "@/src/lib/query-params";
import { hasPermission } from "@/src/lib/rbac";
import { prisma } from "@/src/lib/prisma";
import {
  archiveSubcontractor,
  bulkArchiveSubcontractorsAction,
  updateSubcontractorAction,
  updateSubcontractorStatus,
} from "./actions";
import { SUBCONTRACTOR_APPROVAL_STATUSES } from "./constants";
import { SubcontractorCreateForm } from "./subcontractor-create-form";

const subcontractorStatusLabels: Record<SubcontractorApprovalStatus, string> = {
  IN_VERIFICARE: "In verificare",
  APROBAT: "Aprobat",
  RESPINS: "Respins",
  SUSPENDAT: "Suspendat",
};

const subcontractorStatusOptions = [...SUBCONTRACTOR_APPROVAL_STATUSES];
const archiveVisibilityOptions = ["active", "archived", "all"] as const;
type ArchiveVisibility = (typeof archiveVisibilityOptions)[number];
const archiveVisibilityLabels: Record<ArchiveVisibility, string> = {
  active: "Active",
  archived: "Arhivate",
  all: "Toate",
};

function buildSubcontractoriHref({
  page,
  q,
  status,
  archived,
  dialog,
}: {
  page?: number;
  q?: string;
  status?: SubcontractorApprovalStatus | null;
  archived?: ArchiveVisibility;
  dialog?: "create";
}) {
  return buildListHref("/subcontractori", {
    page,
    q,
    status: status || undefined,
    archived: archived === "active" ? undefined : archived,
    dialog,
  });
}

function getStatusTone(status: SubcontractorApprovalStatus) {
  switch (status) {
    case "APROBAT":
      return "success";
    case "RESPINS":
      return "danger";
    case "SUSPENDAT":
      return "warning";
    default:
      return "info";
  }
}

export default async function SubcontractoriPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string; dialog?: string; archived?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() || "";
  const statusFilter = parseEnumParam(params.status, subcontractorStatusOptions);
  const archivedFilter = parseEnumParam(params.archived, archiveVisibilityOptions) || "active";
  const page = parsePositiveIntParam(params.page);
  const pageSize = 12;
  const createDialogOpen = params.dialog === "create";
  const session = await auth();
  const userContext = {
    id: session?.user?.id || "",
    email: session?.user?.email || null,
    roleKeys: session?.user?.roleKeys || [],
  };
  const canCreate = hasPermission(userContext.roleKeys, "TASKS", "CREATE", userContext.email);
  const canUpdate = hasPermission(userContext.roleKeys, "TASKS", "UPDATE", userContext.email);
  const canDelete = hasPermission(userContext.roleKeys, "TASKS", "DELETE", userContext.email);
  const scope = session?.user
    ? await resolveAccessScope(userContext)
    : { projectIds: null, teamId: null };
  // We removed project-based filtering for subcontractors to allow Managers and Admin to see all collaborators in the catalog.
  // const where: Prisma.SubcontractorWhereInput = { ...subcontractorScopeWhere(scope) };
  const where: Prisma.SubcontractorWhereInput = {};
  const andFilters: Prisma.SubcontractorWhereInput[] = [];

  if (archivedFilter === "active") {
    where.deletedAt = null;
  } else if (archivedFilter === "archived") {
    where.deletedAt = { not: null };
  }

  if (statusFilter) {
    andFilters.push({ approvalStatus: statusFilter });
  }
  if (query) {
    andFilters.push({
      OR: [
        { name: { contains: query, mode: "insensitive" } },
        { cui: { contains: query, mode: "insensitive" } },
        { contactName: { contains: query, mode: "insensitive" } },
        { email: { contains: query, mode: "insensitive" } },
        { phone: { contains: query, mode: "insensitive" } },
        { notes: { contains: query, mode: "insensitive" } },
      ],
    });
  }

  const filteredWhere = andFilters.length > 0 ? { ...where, AND: andFilters } : where;
  const scopedProjectIds = scope.projectIds && scope.projectIds.length > 0 ? scope.projectIds : ["__none__"];
  const assignmentProjectFilter =
    scope.projectIds === null ? {} : { projectId: { in: scopedProjectIds } };
  const [totalSubcontractors, statusBreakdown, activeAssignmentsTotal] = await Promise.all([
    prisma.subcontractor.count({ where: filteredWhere }),
    prisma.subcontractor.groupBy({
      by: ["approvalStatus"],
      where: filteredWhere,
      _count: { _all: true },
    }),
    prisma.subcontractorAssignment.count({
      where: {
        status: AssignmentStatus.ACTIV,
        ...assignmentProjectFilter,
        subcontractor: filteredWhere,
      },
    }),
  ]);
  const statusCountByKey = new Map<SubcontractorApprovalStatus, number>(
    statusBreakdown.map((item) => [item.approvalStatus, item._count._all]),
  );
  const { totalPages, currentPage, skip, take } = resolvePagination({
    page,
    totalItems: totalSubcontractors,
    pageSize,
  });
  const subcontractors = await prisma.subcontractor.findMany({
    where: filteredWhere,
    select: {
      id: true,
      name: true,
      approvalStatus: true,
      contactName: true,
      email: true,
      phone: true,
      cui: true,
      notes: true,
      deletedAt: true,
      updatedAt: true,
      assignments: {
        where: {
          status: AssignmentStatus.ACTIV,
          ...assignmentProjectFilter,
        },
        select: { id: true },
      },
    },
    orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
    skip,
    take,
  });
  const hasFilters = Boolean(query || statusFilter || archivedFilter !== "active");
  const activeSubcontractorsOnPage = subcontractors.filter((company) => !company.deletedAt);
  const createHref = buildSubcontractoriHref({ page: currentPage, q: query, status: statusFilter, archived: archivedFilter, dialog: "create" });
  const closeHref = buildSubcontractoriHref({ page: currentPage, q: query, status: statusFilter, archived: archivedFilter });
  const prevHref = currentPage > 1 ? buildSubcontractoriHref({ page: currentPage - 1, q: query, status: statusFilter, archived: archivedFilter, dialog: createDialogOpen ? "create" : undefined }) : null;
  const nextHref = currentPage < totalPages ? buildSubcontractoriHref({ page: currentPage + 1, q: query, status: statusFilter, archived: archivedFilter, dialog: createDialogOpen ? "create" : undefined }) : null;

  return (
    <PermissionGuard resource="TASKS" action="VIEW">
      <div className="space-y-6">
        <PageHeader
          title="Subcontractori"
          subtitle="Administrare subcontractori: conformitate, date comerciale, status aprobare si alocari active pe proiecte."
          actions={
            canCreate ? (
              <Link href={createHref}>
                <Button>Adauga subcontractor</Button>
              </Link>
            ) : null
          }
        />

        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">{totalSubcontractors} subcontractori gasiti</Badge>
            {hasFilters ? <Badge tone="info">Filtru activ</Badge> : <Badge tone="success">Fara filtre</Badge>}
          </div>
          <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(220px,0.85fr)_minmax(200px,0.85fr)_auto]">
            <form method="get" action="/subcontractori" className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(220px,0.85fr)_minmax(200px,0.85fr)_auto] lg:col-span-2">
              <input type="hidden" name="page" value="1" />
              <Input name="q" defaultValue={query} placeholder="Cauta dupa nume, CUI, contact, email, telefon sau nota" />
              <select
                name="status"
                defaultValue={statusFilter || ""}
                className="h-11 rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 text-sm text-[var(--foreground)]"
              >
                <option value="">Toate statusurile</option>
                {subcontractorStatusOptions.map((status) => (
                  <option key={status} value={status}>
                    {subcontractorStatusLabels[status]}
                  </option>
                ))}
              </select>
              <select
                name="archived"
                defaultValue={archivedFilter}
                className="h-11 rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 text-sm text-[var(--foreground)]"
              >
                {archiveVisibilityOptions.map((option) => (
                  <option key={option} value={option}>
                    {archiveVisibilityLabels[option]}
                  </option>
                ))}
              </select>
              <Button type="submit" variant="secondary" className="w-full lg:w-auto">
                Aplica filtre
              </Button>
            </form>
            {hasFilters ? (
              <form method="get" action="/subcontractori" className="lg:self-end">
                <Button type="submit" variant="ghost" className="w-full lg:w-auto">
                  Reseteaza
                </Button>
              </form>
            ) : null}
          </div>
        </Card>

        {canCreate && createDialogOpen ? (
          <div className="fixed inset-0 z-50 flex items-end justify-center bg-[rgba(7,12,18,0.74)] p-3 sm:items-center sm:p-6">
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="subcontractor-create-title"
              className="w-full max-w-4xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--shadow-panel)]"
            >
              <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-4 py-3 sm:px-5">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Creare subcontractor</p>
                  <h2 id="subcontractor-create-title" className="mt-1 text-lg font-semibold text-[var(--foreground)]">
                    Adauga subcontractor
                  </h2>
                  <p className="mt-1 text-sm text-[var(--muted)]">
                    Formularul este deschis intr-un dialog pentru a pastra contextul listei si filtrul curent.
                  </p>
                </div>
                <Link href={closeHref}>
                  <Button variant="ghost" size="sm" aria-label="Inchide formularul">
                    Inchide
                  </Button>
                </Link>
              </div>
              <div className="max-h-[80vh] overflow-y-auto px-4 py-4 sm:px-5">
                <SubcontractorCreateForm />
              </div>
            </div>
          </div>
        ) : null}

        {canDelete ? (
          <Card className="bulk-zone">
            <details>
              <summary>Actiuni bulk subcontractori</summary>
              <form action={bulkArchiveSubcontractorsAction} className="mt-3 space-y-3">
                <div className="bulk-controls flex flex-wrap items-center gap-2">
                  <Badge tone="warning">Arhivare soft delete</Badge>
                  <ConfirmSubmitButton
                    text="Arhiveaza selectia"
                    confirmMessage="Confirmi arhivarea subcontractorilor selectati?"
                    variant="destructive"
                  />
                </div>
                <div className="max-h-36 overflow-y-auto rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3">
                  {activeSubcontractorsOnPage.length > 0 ? (
                    <div className="grid gap-1 md:grid-cols-2">
                      {activeSubcontractorsOnPage.map((company) => (
                        <label key={company.id} className="flex items-center gap-2 text-sm text-[var(--muted-strong)]">
                          <input type="checkbox" name="ids" value={company.id} className="h-4 w-4" />
                          <span>{company.name}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[var(--muted)]">Nu exista subcontractori activi pe pagina curenta pentru arhivare.</p>
                  )}
                </div>
              </form>
            </details>
          </Card>
        ) : null}

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Companii active</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{totalSubcontractors}</p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Aprobate</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
              {statusCountByKey.get("APROBAT") || 0}
            </p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">In verificare</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
              {statusCountByKey.get("IN_VERIFICARE") || 0}
            </p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Alocari active</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{activeAssignmentsTotal}</p>
          </Card>
        </section>

        {subcontractors.length === 0 ? (
          <EmptyState
            title={hasFilters ? "Nu exista subcontractori care sa corespunda filtrelor" : "Nu exista subcontractori vizibili in aria ta"}
            description={
              hasFilters
                ? "Sterge filtrele sau schimba criteriile de cautare pentru alte rezultate."
                : "Adauga un subcontractor nou sau extinde aria de acces pentru a vedea alocarile existente."
            }
          />
        ) : null}

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {subcontractors.map((company) => (
            <Card key={company.id} className="space-y-3">
              {company.deletedAt ? <Badge tone="warning">Arhivat</Badge> : null}
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-[var(--foreground)]">{company.name}</p>
                <Badge tone={getStatusTone(company.approvalStatus)}>{subcontractorStatusLabels[company.approvalStatus]}</Badge>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs text-[var(--muted)]">
                <p>Contact: {company.contactName || "-"}</p>
                <p>Email: {company.email || "-"}</p>
                <p className="col-span-2">CUI: {company.cui || "-"}</p>
                <p className="col-span-2">Alocari active: {company.assignments.length}</p>
              </div>
              <p className="text-xs text-[var(--muted)]">Nota: {company.notes || "-"}</p>

              {canUpdate && !company.deletedAt ? (
                <>
                  <form action={updateSubcontractorAction} className="mt-3 grid gap-2">
                    <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Date comerciale</p>
                    <input type="hidden" name="id" value={company.id} />
                    <Input name="name" defaultValue={company.name} />
                    <Input name="cui" defaultValue={company.cui || ""} />
                    <Input name="contactName" defaultValue={company.contactName || ""} />
                    <Input name="email" defaultValue={company.email || ""} />
                    <Input name="phone" defaultValue={company.phone || ""} />
                    <Button type="submit" size="sm">Salveaza detalii</Button>
                  </form>

                  <form action={updateSubcontractorStatus} className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                    <input type="hidden" name="id" value={company.id} />
                    <select name="approvalStatus" defaultValue={company.approvalStatus} className="h-9 w-full rounded-md border border-[var(--border)] px-2 text-xs">
                      {SUBCONTRACTOR_APPROVAL_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {subcontractorStatusLabels[status]}
                        </option>
                      ))}
                    </select>
                    <Button type="submit" size="sm" variant="secondary" className="w-full sm:w-auto">Actualizeaza</Button>
                  </form>
                </>
              ) : (
                <p className="mt-3 text-xs text-[var(--muted)]">
                  {company.deletedAt
                    ? "Subcontractor arhivat. Poti consulta doar datele istorice."
                    : "Doar utilizatorii cu drept de actualizare lucrari pot modifica subcontractorii."}
                </p>
              )}
              {canDelete && !company.deletedAt ? (
                <form action={archiveSubcontractor} className="mt-2">
                  <input type="hidden" name="id" value={company.id} />
                  <ConfirmSubmitButton
                    text="Arhiveaza subcontractor"
                    confirmMessage={`Confirmi arhivarea subcontractorului ${company.name}?`}
                    variant="destructive"
                  />
                </form>
              ) : null}
            </Card>
          ))}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4 text-sm text-[var(--muted)]">
          <span>
            Pagina {currentPage} din {totalPages}
          </span>
          <div className="flex gap-2">
            {prevHref ? (
              <Link className="rounded-lg border border-[var(--border)] px-3 py-1.5 hover:border-[var(--border-strong)]" href={prevHref}>
                Anterior
              </Link>
            ) : null}
            {nextHref ? (
              <Link className="rounded-lg border border-[var(--border)] px-3 py-1.5 hover:border-[var(--border-strong)]" href={nextHref}>
                Urmator
              </Link>
            ) : null}
          </div>
        </div>
      </div>
    </PermissionGuard>
  );
}
