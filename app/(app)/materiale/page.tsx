import { MaterialRequestStatus, RoleKey, StockMovementType } from "@prisma/client";
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
import { resolveAccessScope } from "@/src/lib/access-scope";
import { parseEnumParam, parsePositiveIntParam } from "@/src/lib/query-params";
import { hasPermission } from "@/src/lib/rbac";
import { prisma } from "@/src/lib/prisma";
import { approveAndIssueMaterialRequest, approveMaterialRequest, bulkMaterialRequestsAction } from "./actions";
import { MaterialCreateForm, MaterialInvoiceUploadForm, MaterialRequestForm, StockMovementForm } from "./material-forms";

const requestStatusLabels: Record<MaterialRequestStatus, string> = {
  PENDING: "In asteptare",
  APPROVED: "Aprobata",
  REJECTED: "Respinsa",
  ISSUED: "Emisa din stoc",
  PARTIAL: "Partial emisa",
};

const movementLabels: Record<StockMovementType, string> = {
  IN: "Intrare",
  OUT: "Iesire",
  TRANSFER: "Transfer",
  RETURN: "Returnare",
  WASTE: "Casare",
  ADJUSTMENT: "Ajustare",
};

const movementTones: Record<StockMovementType, "success" | "warning" | "danger" | "neutral" | "info"> = {
  IN: "info",
  OUT: "warning",
  TRANSFER: "neutral",
  RETURN: "success",
  WASTE: "danger",
  ADJUSTMENT: "neutral",
};

const dateTimeFormatter = new Intl.DateTimeFormat("ro-RO", {
  dateStyle: "short",
  timeStyle: "short",
});

function formatPerson(person?: { firstName: string; lastName: string } | null) {
  return person ? `${person.firstName} ${person.lastName}` : "Nespecificat";
}

function formatDateTime(value?: Date | string | null) {
  if (!value) return "-";
  return dateTimeFormatter.format(new Date(value));
}

function formatQuantity(value: number) {
  return value.toLocaleString("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function requestTone(status: MaterialRequestStatus): "success" | "warning" | "danger" | "neutral" | "info" {
  switch (status) {
    case MaterialRequestStatus.APPROVED:
    case MaterialRequestStatus.ISSUED:
      return "success";
    case MaterialRequestStatus.PENDING:
      return "warning";
    case MaterialRequestStatus.REJECTED:
      return "danger";
    case MaterialRequestStatus.PARTIAL:
      return "info";
    default:
      return "neutral";
  }
}

export default async function MaterialePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: string }>;
}) {
  const params = await searchParams;
  const page = parsePositiveIntParam(params.page);
  const statusFilter = parseEnumParam(params.status, Object.values(MaterialRequestStatus));
  const pageSize = 20;
  const session = await auth();
  const scope = session?.user
    ? await resolveAccessScope({
        id: session.user.id,
        email: session.user.email,
        roleKeys: session.user.roleKeys || [],
      })
    : { projectIds: null, teamId: null };
  const scopedProjectFilter = scope.projectIds === null ? null : { in: scope.projectIds.length ? scope.projectIds : ["__none__"] };
  const roleKeys = session?.user?.roleKeys || [];
  const userEmail = session?.user?.email || null;
  const canCreateMaterials = hasPermission(roleKeys, "MATERIALS", "CREATE", userEmail);
  const canApproveRequests = hasPermission(roleKeys, "MATERIALS", "APPROVE", userEmail);
  const canExportMaterials = hasPermission(roleKeys, "MATERIALS", "EXPORT", userEmail);
  const stockInvoiceRoles = new Set<RoleKey>([
    RoleKey.SUPER_ADMIN,
    RoleKey.ADMINISTRATOR,
    RoleKey.SITE_MANAGER,
    RoleKey.ACCOUNTANT,
  ]);
  const canManageStockAndInvoices = roleKeys.some((role) => stockInvoiceRoles.has(role as RoleKey));
  const materialWhere = params.q
    ? {
        OR: [
          { name: { contains: params.q, mode: "insensitive" as const } },
          { code: { contains: params.q, mode: "insensitive" as const } },
        ],
      }
    : undefined;
  const requestWhere = scope.projectIds === null ? {} : { projectId: scopedProjectFilter! };
  const requestHistoryStatuses = Object.values(MaterialRequestStatus).filter((status) => status !== MaterialRequestStatus.PENDING);

  const [materials, materialOptions, totalMaterials, requests, projects, warehouses, materialInvoices, recentMovements] = await Promise.all([
    prisma.material.findMany({
      where: materialWhere,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { name: "asc" },
      select: {
        id: true,
        code: true,
        name: true,
        unitOfMeasure: true,
        minStockLevel: true,
      },
    }),
    prisma.material.findMany({
      where: materialWhere,
      select: { id: true, name: true },
      orderBy: { name: "asc" },
      take: 400,
    }),
    prisma.material.count({ where: materialWhere }),
    prisma.materialRequest.findMany({
      select: {
        id: true,
        quantity: true,
        status: true,
        note: true,
        requestedAt: true,
        approvedAt: true,
        material: { select: { name: true, unitOfMeasure: true } },
        project: { select: { title: true } },
        requestedBy: { select: { firstName: true, lastName: true } },
        approvedBy: { select: { firstName: true, lastName: true } },
      },
      where: requestWhere,
      orderBy: { requestedAt: "desc" },
      take: 50,
    }),
    prisma.project.findMany({
      where: { deletedAt: null, ...(scope.projectIds === null ? {} : { id: scopedProjectFilter! }) },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    prisma.warehouse.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.document.findMany({
      where: {
        category: "INVOICE",
        tags: { has: "material-invoice" },
        ...(scope.projectIds === null ? {} : { projectId: scopedProjectFilter! }),
      },
      select: {
        id: true,
        title: true,
        fileName: true,
        storagePath: true,
        createdAt: true,
        project: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    prisma.stockMovement.findMany({
      where: scope.projectIds === null ? {} : { projectId: scopedProjectFilter! },
      select: {
        id: true,
        type: true,
        quantity: true,
        note: true,
        documentRef: true,
        movedAt: true,
        material: { select: { code: true, name: true, unitOfMeasure: true } },
        warehouse: { select: { name: true } },
        project: { select: { title: true } },
      },
      orderBy: { movedAt: "desc" },
      take: 10,
    }),
  ]);

  const movementSums = materials.length
    ? await prisma.stockMovement.groupBy({
        by: ["materialId", "type"],
        where: { materialId: { in: materials.map((material) => material.id) } },
        _sum: { quantity: true },
      })
    : [];
  const stockByMaterial = new Map<string, number>();
  for (const row of movementSums) {
    const signedQty =
      row.type === StockMovementType.OUT || row.type === StockMovementType.WASTE
        ? -Number(row._sum.quantity || 0)
        : Number(row._sum.quantity || 0);
    stockByMaterial.set(row.materialId, (stockByMaterial.get(row.materialId) || 0) + signedQty);
  }

  const materialRows = materials.map((material) => {
    const stock = stockByMaterial.get(material.id) || 0;
    const min = Number(material.minStockLevel || 0);
    return { ...material, stock, min };
  });
  const lowStockRows = materialRows.filter((row) => row.stock <= row.min);
  const pendingRequests = requests.filter((request) => request.status === MaterialRequestStatus.PENDING);
  const historyRequests = statusFilter
    ? requests.filter((request) => request.status === statusFilter)
    : requests.filter((request) => request.status !== MaterialRequestStatus.PENDING).slice(0, 8);
  const recentIssueReturnMovements = recentMovements.filter(
    (movement) => movement.type === StockMovementType.OUT || movement.type === StockMovementType.RETURN,
  );
  const totalPages = Math.max(1, Math.ceil(totalMaterials / pageSize));

  return (
    <PermissionGuard resource="MATERIALS" action="VIEW">
      <div className="space-y-6">
        <PageHeader
          title="Materiale si stoc"
          subtitle="Cereri, depozite, miscari si aprobari intr-un singur loc, cu traseu clar pentru inginer si magazioner."
        />

        <Card className="flex flex-col gap-3 border-[var(--border)]/70 bg-[var(--surface-card)] md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Flux recomandat</p>
            <p className="text-sm text-[var(--foreground)]">
              Inginerul trimite cererea, responsabilul de depozit aproba sau elibereaza materialele, iar istoricul ramane legat de proiect.
            </p>
          </div>
          {canExportMaterials ? (
            <Link href="/api/export/materiale">
              <Button variant="secondary">Export CSV materiale</Button>
            </Link>
          ) : null}
        </Card>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Stare stoc</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Materiale sub prag</h2>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-3xl font-semibold text-[var(--foreground)]">{lowStockRows.length}</p>
                <p className="text-sm text-[var(--muted)]">pe pagina curenta</p>
              </div>
              <Badge tone={lowStockRows.length > 0 ? "warning" : "success"}>{lowStockRows.length > 0 ? "Verifica stocul" : "Stoc ok"}</Badge>
            </div>
          </Card>

          <Card>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Cereri</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">In asteptare</h2>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-3xl font-semibold text-[var(--foreground)]">{pendingRequests.length}</p>
                <p className="text-sm text-[var(--muted)]">cereri deschise</p>
              </div>
              <Badge tone={pendingRequests.length > 0 ? "warning" : "neutral"}>{pendingRequests.length > 0 ? "Aprobare necesara" : "Fara cereri"}</Badge>
            </div>
          </Card>

          <Card>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Depozite</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Vizibile in operare</h2>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-3xl font-semibold text-[var(--foreground)]">{warehouses.length}</p>
                <p className="text-sm text-[var(--muted)]">depozite active</p>
              </div>
              <Badge tone={warehouses.length > 0 ? "info" : "neutral"}>{warehouses.length > 0 ? "Alege depozitul" : "Niciun depozit"}</Badge>
            </div>
          </Card>

          <Card>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Istoric depozit</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Iesiri si retururi recente</h2>
            <div className="mt-3 flex items-end justify-between gap-3">
              <div>
                <p className="text-3xl font-semibold text-[var(--foreground)]">{recentIssueReturnMovements.length}</p>
                <p className="text-sm text-[var(--muted)]">miscari urmarite</p>
              </div>
              <Badge tone={recentIssueReturnMovements.length > 0 ? "info" : "neutral"}>
                {recentIssueReturnMovements.length > 0 ? "Urmarire activa" : "Fara miscari"}
              </Badge>
            </div>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Catalog</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Adauga material</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Pastreaza codul unic, unitatea de masura si pragul minim pentru alerte rapide in depozit.</p>
            {canCreateMaterials ? <MaterialCreateForm /> : <p className="mt-3 text-sm text-[var(--muted)]">Nu ai drept de creare materiale.</p>}
          </Card>

          <Card>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Inginer / santier</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Trimite cerere de materiale</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Cererea merge la aprobare. Nu modifica stocul direct; magazionerul va decide separat daca elibereaza materialul din depozit.
            </p>
            {canCreateMaterials ? (
              <MaterialRequestForm
                projects={projects.map((project) => ({ id: project.id, label: project.title }))}
                materials={materialOptions.map((material) => ({ id: material.id, label: material.name }))}
              />
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">Nu ai drept de creare cereri materiale.</p>
            )}
          </Card>

          <Card>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Magazioner / depozit</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Inregistreaza miscarea de stoc</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">
              Foloseste pentru intrari, iesiri, retururi, transferuri si corectii. Aici se vede clar de unde pleaca sau unde ajunge materialul.
            </p>
            {canManageStockAndInvoices ? (
              <StockMovementForm
                projects={projects.map((project) => ({ id: project.id, label: project.title }))}
                materials={materialOptions.map((material) => ({ id: material.id, label: material.name }))}
                warehouses={warehouses.map((warehouse) => ({ id: warehouse.id, label: warehouse.name }))}
              />
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">Disponibil doar pentru rolurile Admin, Sef Santier si Financiar.</p>
            )}
          </Card>

          <Card>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Facturi materiale</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Incarca documentul</h2>
            <p className="mt-2 text-sm text-[var(--muted)]">Leaga factura de proiectul corect ca sa poti urmari repede costul si actele primite de la furnizor.</p>
            {canManageStockAndInvoices ? (
              <MaterialInvoiceUploadForm projects={projects.map((project) => ({ id: project.id, label: project.title }))} />
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">Incarcarea facturilor este disponibila doar pentru Admin, Sef Santier si Financiar.</p>
            )}
            <div className="mt-4 space-y-2">
              {materialInvoices.length === 0 ? (
                <p className="text-sm text-[var(--muted)]">Nicio factura materiale incarcata inca.</p>
              ) : (
                materialInvoices.map((doc) => (
                  <a
                    key={doc.id}
                    href={doc.storagePath}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="block rounded-lg border border-[var(--border)] bg-[var(--surface-card)] p-3 text-sm transition-colors hover:border-[var(--border-strong)]"
                  >
                    <p className="font-semibold text-[var(--foreground)]">{doc.title}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {doc.project?.title || "General"} • {doc.fileName} • {formatDateTime(doc.createdAt)}
                    </p>
                  </a>
                ))
              )}
            </div>
          </Card>
        </section>

        <Card>
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Filtre</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Cauta materiale si filtreaza istoricul cererilor</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">
                Cautarea afecteaza catalogul de materiale, iar starea filtreaza istoricul de mai jos.
              </p>
            </div>
          </div>
          <form className="mb-3 mt-4 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <input type="hidden" name="page" value="1" />
            <Input name="q" defaultValue={params.q || ""} placeholder="Cauta material" />
            <select name="status" defaultValue={statusFilter || ""} className="h-11 rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3.5 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--border-strong)] focus:ring-2 focus:ring-[rgba(95,142,193,0.2)]">
              <option value="">Toate starile istoricului</option>
              {requestHistoryStatuses.map((status) => (
                <option key={status} value={status}>
                  {requestStatusLabels[status]}
                </option>
              ))}
            </select>
            <Button type="submit" variant="secondary">
              Filtreaza
            </Button>
          </form>

          {materials.length === 0 ? (
            <EmptyState title="Nu exista materiale" description="Configureaza catalogul de materiale." />
          ) : (
            <div>
              {lowStockRows.length > 0 ? (
                <div className="mb-3 rounded-lg border border-[rgba(184,142,67,0.4)] bg-[rgba(184,142,67,0.12)] p-3 text-sm text-[#eed8a8]">
                  {lowStockRows.length} materiale sunt sub pragul minim pe pagina curenta. Verifica iesirile inainte sa aprobi noi consumuri.
                </div>
              ) : null}
              <div className="space-y-3 md:hidden">
                {materialRows.map((material) => {
                  const statusTone = material.stock <= 0 ? "danger" : material.stock <= material.min ? "warning" : "success";
                  const statusLabel = material.stock <= 0 ? "Stoc zero" : material.stock <= material.min ? "Stoc scazut" : "Stoc ok";
                  return (
                    <div key={material.id} className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[var(--foreground)]">{material.name}</p>
                          <p className="text-xs text-[var(--muted)]">
                            {material.code} • {material.unitOfMeasure}
                          </p>
                        </div>
                        <Badge tone={statusTone}>{statusLabel}</Badge>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#cfdff5]">
                        <p>Stoc: {formatQuantity(material.stock)}</p>
                        <p>Prag: {formatQuantity(material.min)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="hidden overflow-x-auto rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] md:block">
                <Table>
                  <thead>
                    <tr>
                      <TH>Cod</TH>
                      <TH>Material</TH>
                      <TH>UM</TH>
                      <TH>Stoc curent</TH>
                      <TH>Prag minim</TH>
                      <TH>Stare</TH>
                    </tr>
                  </thead>
                  <tbody>
                    {materialRows.map((material) => {
                      const statusTone = material.stock <= 0 ? "danger" : material.stock <= material.min ? "warning" : "success";
                      const statusLabel = material.stock <= 0 ? "Stoc zero" : material.stock <= material.min ? "Stoc scazut" : "Stoc ok";
                      return (
                        <tr key={material.id}>
                          <TD>{material.code}</TD>
                          <TD>{material.name}</TD>
                          <TD>{material.unitOfMeasure}</TD>
                          <TD>{formatQuantity(material.stock)}</TD>
                          <TD>{formatQuantity(material.min)}</TD>
                          <TD>
                            <Badge tone={statusTone}>{statusLabel}</Badge>
                          </TD>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              </div>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between text-sm text-[var(--muted)]">
            <span>
              Pagina {page} din {totalPages}
            </span>
            <div className="flex gap-2">
              {page > 1 ? (
                <Link
                  className="rounded-md border border-[var(--border)] px-3 py-1 hover:border-[var(--border-strong)]"
                  href={`/materiale?page=${page - 1}&q=${encodeURIComponent(params.q || "")}&status=${statusFilter || ""}`}
                >
                  Anterior
                </Link>
              ) : null}
              {page < totalPages ? (
                <Link
                  className="rounded-md border border-[var(--border)] px-3 py-1 hover:border-[var(--border-strong)]"
                  href={`/materiale?page=${page + 1}&q=${encodeURIComponent(params.q || "")}&status=${statusFilter || ""}`}
                >
                  Urmator
                </Link>
              ) : null}
            </div>
          </div>
        </Card>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Depozit</p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Istoric miscari recente</h2>
              </div>
              <Badge tone={recentIssueReturnMovements.length > 0 ? "info" : "neutral"}>{recentIssueReturnMovements.length} iesiri/retururi</Badge>
            </div>
            <div className="mt-3 space-y-2">
              {recentMovements.length === 0 ? (
                <EmptyState title="Nicio miscare recenta" description="Inca nu exista miscari de stoc inregistrate." />
              ) : (
                recentMovements.map((movement) => (
                  <div key={movement.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)] p-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge tone={movementTones[movement.type]}>{movementLabels[movement.type]}</Badge>
                          <span className="font-semibold text-[var(--foreground)]">{movement.material.name}</span>
                        </div>
                        <p className="text-xs text-[var(--muted)]">
                          {movement.warehouse.name} • {movement.material.code} • {formatDateTime(movement.movedAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-semibold text-[var(--foreground)]">
                          {formatQuantity(Number(movement.quantity))} {movement.material.unitOfMeasure}
                        </p>
                        {movement.documentRef ? <p className="text-xs text-[var(--muted)]">Ref: {movement.documentRef}</p> : null}
                      </div>
                    </div>
                    <p className="mt-2 text-xs text-[var(--muted)]">
                      Proiect: {movement.project?.title || "Fara proiect"}
                      {movement.note ? ` • ${movement.note}` : ""}
                    </p>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Aprobari</p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Cereri de aprobat si istoric recent</h2>
              </div>
              <Badge tone={pendingRequests.length > 0 ? "warning" : "neutral"}>{pendingRequests.length} in asteptare</Badge>
            </div>

            {canApproveRequests ? (
              <form action={bulkMaterialRequestsAction} className="mt-4 space-y-3">
                <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                  <select name="operation" defaultValue="APPROVE" className="h-11 rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3.5 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--border-strong)] focus:ring-2 focus:ring-[rgba(95,142,193,0.2)]">
                    <option value="APPROVE">Aproba selectie</option>
                    <option value="REJECT">Respinge selectie</option>
                  </select>
                  <ConfirmSubmitButton text="Executa selectie" confirmMessage="Confirmi actiunea asupra cererilor selectate?" />
                </div>
                <div className="rounded-lg border border-[var(--border)] p-3">
                  {pendingRequests.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">Nu exista cereri in asteptare.</p>
                  ) : (
                    <div className="grid gap-2 md:grid-cols-2">
                      {pendingRequests.map((request) => (
                        <label key={request.id} className="flex items-start gap-2 text-sm">
                          <input type="checkbox" name="ids" value={request.id} className="mt-1" />
                          <span>
                            {request.project.title} - {request.material.name} - {formatQuantity(Number(request.quantity))} {request.material.unitOfMeasure}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              </form>
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">Aprobarea cererilor este disponibila doar pentru rolurile cu drept de aprobare materiale.</p>
            )}

            <div className="mt-4 space-y-3">
              {pendingRequests.length > 0 ? (
                pendingRequests.map((request) => (
                  <div key={request.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)] p-3 text-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-[var(--foreground)]">{request.project.title}</p>
                        <p className="text-xs text-[var(--muted)]">
                          {request.material.name} • {formatQuantity(Number(request.quantity))} {request.material.unitOfMeasure}
                        </p>
                      </div>
                      <Badge tone={requestTone(request.status)}>{requestStatusLabels[request.status]}</Badge>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
                      <span>Solicitant: {formatPerson(request.requestedBy)}</span>
                      <span>Trimisa: {formatDateTime(request.requestedAt)}</span>
                      {request.note ? <span>Nota: {request.note}</span> : null}
                    </div>
                    {canApproveRequests ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <form action={approveMaterialRequest}>
                          <input type="hidden" name="id" value={request.id} />
                          <input type="hidden" name="status" value={MaterialRequestStatus.APPROVED} />
                          <Button size="sm" type="submit" variant="secondary">
                            Aproba cererea
                          </Button>
                        </form>
                        {canManageStockAndInvoices ? (
                          <form action={approveAndIssueMaterialRequest} className="flex flex-wrap gap-2">
                            <input type="hidden" name="id" value={request.id} />
                            <select
                              name="warehouseId"
                              required
                              defaultValue={warehouses[0]?.id || ""}
                              className="h-9 rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-2 text-xs text-[var(--foreground)]"
                            >
                              <option value="" disabled>
                                Alege depozitul
                              </option>
                              {warehouses.map((warehouse) => (
                                <option key={warehouse.id} value={warehouse.id}>
                                  {warehouse.name}
                                </option>
                              ))}
                            </select>
                            <Button size="sm" type="submit" disabled={warehouses.length === 0}>
                              Aproba si elibereaza
                            </Button>
                          </form>
                        ) : null}
                        <form action={approveMaterialRequest}>
                          <input type="hidden" name="id" value={request.id} />
                          <input type="hidden" name="status" value={MaterialRequestStatus.REJECTED} />
                          <Button size="sm" type="submit" variant="destructive">
                            Respinge cererea
                          </Button>
                        </form>
                      </div>
                    ) : null}
                  </div>
                ))
              ) : (
                <EmptyState title="Fara cereri in asteptare" description="Cereri noi sau aprobate apar aici cu solicitant si proiect." />
              )}

              <div className="mt-5 border-t border-[var(--border)] pt-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Istoric</p>
                    <h3 className="mt-1 text-base font-semibold text-[var(--foreground)]">
                      {statusFilter ? requestStatusLabels[statusFilter] : "Ultimele cereri procesate"}
                    </h3>
                  </div>
                  <Badge tone={historyRequests.length > 0 ? "info" : "neutral"}>{historyRequests.length} in lista</Badge>
                </div>
                <div className="mt-3 space-y-2">
                  {historyRequests.length === 0 ? (
                    <p className="text-sm text-[var(--muted)]">Nu exista cereri pentru filtrul selectat.</p>
                  ) : (
                    historyRequests.map((request) => (
                      <div key={request.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)] p-3 text-sm">
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div>
                            <p className="font-semibold text-[var(--foreground)]">{request.project.title}</p>
                            <p className="text-xs text-[var(--muted)]">
                              {request.material.name} • {formatQuantity(Number(request.quantity))} {request.material.unitOfMeasure}
                            </p>
                          </div>
                          <Badge tone={requestTone(request.status)}>{requestStatusLabels[request.status]}</Badge>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[var(--muted)]">
                          <span>Solicitant: {formatPerson(request.requestedBy)}</span>
                          <span>Procesat de: {formatPerson(request.approvedBy)}</span>
                          <span>La: {formatDateTime(request.approvedAt || request.requestedAt)}</span>
                          {request.note ? <span>Nota: {request.note}</span> : null}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </PermissionGuard>
  );
}
