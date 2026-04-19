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
  const materialWhere = {
    name: params.q ? { contains: params.q, mode: "insensitive" as const } : undefined,
  };

  const [materials, materialOptions, totalMaterials, requests, projects, warehouses, materialInvoices] = await Promise.all([
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
        internalCost: true,
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
        material: { select: { name: true, unitOfMeasure: true } },
        project: { select: { title: true } },
        requestedBy: { select: { firstName: true, lastName: true } },
      },
      where: {
        status: statusFilter,
        ...(scope.projectIds === null ? {} : { projectId: scopedProjectFilter! }),
      },
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
      include: { project: true },
      orderBy: { createdAt: "desc" },
      take: 40,
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
  const totalPages = Math.max(1, Math.ceil(totalMaterials / pageSize));

  return (
    <PermissionGuard resource="MATERIALS" action="VIEW">
      <div className="space-y-6">
        <PageHeader title="Materiale si stoc" subtitle="Catalog, cereri santier, consum pe proiect, miscari stoc si aprobari" />
        {canExportMaterials ? (
          <div className="flex justify-end">
            <Link href="/api/export/materiale">
              <Button variant="secondary">Export CSV Materiale</Button>
            </Link>
          </div>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Catalog</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Catalog materiale</h2>
            {canCreateMaterials ? <MaterialCreateForm /> : <p className="mt-3 text-sm text-[var(--muted)]">Nu ai drept de creare materiale.</p>}
          </Card>

          <Card>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Requests</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Cerere materiale</h2>
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Stock Flow</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Miscare de stoc</h2>
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
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Invoices</p>
            <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Facturi materiale</h2>
            {canManageStockAndInvoices ? (
              <MaterialInvoiceUploadForm projects={projects.map((project) => ({ id: project.id, label: project.title }))} />
            ) : (
              <p className="mt-3 text-sm text-[var(--muted)]">Incarcarea facturilor este disponibila doar pentru Admin, Sef Santier si Financiar.</p>
            )}
            <div className="mt-3 space-y-2">
              {materialInvoices.map((doc) => (
                <a key={doc.id} href={doc.storagePath} target="_blank" rel="noreferrer noopener" className="block rounded-lg border border-[var(--border)] p-3 text-sm hover:border-[var(--border-strong)]">
                  <p className="font-semibold">{doc.title}</p>
                  <p className="text-xs text-[var(--muted)]">{doc.project?.title || "General"} • {doc.fileName}</p>
                </a>
              ))}
            </div>
          </Card>
        </section>

        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Filters</p>
          <form className="mb-3 mt-2 grid gap-3 md:grid-cols-3">
            <input type="hidden" name="page" value="1" />
            <Input name="q" defaultValue={params.q || ""} placeholder="Cauta material" />
            <select name="status" defaultValue={statusFilter || ""} className="h-10 rounded-lg border border-[var(--border)] px-3 text-sm">
              <option value="">Toate statusurile cereri</option>
              {Object.values(MaterialRequestStatus).map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <Button type="submit" variant="secondary">Filtreaza</Button>
          </form>

          {materials.length === 0 ? (
            <EmptyState title="Nu exista materiale" description="Configureaza catalogul de materiale." />
          ) : (
            <div>
            <div className="space-y-3 md:hidden">
              {materials.map((material) => {
                const stock = stockByMaterial.get(material.id) || 0;
                const min = Number(material.minStockLevel || 0);
                return (
                  <div key={material.id} className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#e8f2ff]">{material.name}</p>
                        <p className="text-xs text-[var(--muted)]">{material.code} • {material.unitOfMeasure}</p>
                      </div>
                      {stock <= min ? <Badge tone="danger">Stoc scazut</Badge> : <Badge tone="success">OK</Badge>}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-[#cfdff5]">
                      <p>Stoc: {stock.toFixed(2)}</p>
                      <p>Cost: {material.internalCost?.toString() || "0"} RON</p>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="hidden overflow-x-auto rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] md:block">
              <Table>
                <thead><tr><TH>Cod</TH><TH>Material</TH><TH>UM</TH><TH>Stoc curent</TH><TH>Cost intern</TH><TH>Alerte</TH></tr></thead>
                <tbody>
                  {materials.map((material) => {
                    const stock = stockByMaterial.get(material.id) || 0;
                    const min = Number(material.minStockLevel || 0);
                    return (
                      <tr key={material.id}>
                        <TD>{material.code}</TD>
                        <TD>{material.name}</TD>
                        <TD>{material.unitOfMeasure}</TD>
                        <TD>{stock.toFixed(2)}</TD>
                        <TD>{material.internalCost?.toString() || "0"} RON</TD>
                        <TD>{stock <= min ? <Badge tone="danger">Stoc scazut</Badge> : <Badge tone="success">OK</Badge>}</TD>
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
            </div>
          )}
          <div className="mt-3 flex items-center justify-between text-sm text-[var(--muted)]">
            <span>Pagina {page} din {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 ? <Link className="rounded-md border border-[var(--border)] px-3 py-1 hover:border-[var(--border-strong)]" href={`/materiale?page=${page - 1}&q=${encodeURIComponent(params.q || "")}&status=${statusFilter || ""}`}>Anterior</Link> : null}
              {page < totalPages ? <Link className="rounded-md border border-[var(--border)] px-3 py-1 hover:border-[var(--border-strong)]" href={`/materiale?page=${page + 1}&q=${encodeURIComponent(params.q || "")}&status=${statusFilter || ""}`}>Urmator</Link> : null}
            </div>
          </div>
        </Card>

        <Card className="bulk-zone">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">Approval Queue</p>
          <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Cereri materiale recente</h2>
          {canApproveRequests ? (
            <form action={bulkMaterialRequestsAction} className="mt-3 space-y-3">
              <div className="bulk-controls grid gap-2 md:grid-cols-3">
                <select name="operation" defaultValue="APPROVE" className="h-10 rounded-lg border border-[var(--border)] px-3 text-sm">
                  <option value="APPROVE">Aproba selectie</option>
                  <option value="REJECT">Respinge selectie</option>
                </select>
                <div />
                <ConfirmSubmitButton text="Executa bulk" confirmMessage="Confirmi actiunea bulk pe cererile selectate?" />
              </div>
              <div className="grid gap-1 md:grid-cols-2 rounded-lg border border-[var(--border)] p-2">
                {requests.filter((request) => request.status === "PENDING").map((request) => (
                  <label key={request.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="ids" value={request.id} />
                    <span>{request.project.title} - {request.material.name}</span>
                  </label>
                ))}
              </div>
            </form>
          ) : (
            <p className="mt-3 text-sm text-[var(--muted)]">Aprobarea cererilor este disponibila doar pentru rolurile cu drept de aprobare materiale.</p>
          )}
          <div className="mt-3 space-y-2">
            {requests.map((request) => (
              <div key={request.id} className="rounded-lg border border-[var(--border)] bg-[var(--surface-card)] p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{request.project.title} • {request.material.name} • {request.quantity.toString()} {request.material.unitOfMeasure}</span>
                  <Badge tone={request.status === "PENDING" ? "warning" : request.status === "APPROVED" ? "success" : request.status === "REJECTED" ? "danger" : "neutral"}>{request.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">Solicitant: {request.requestedBy.firstName} {request.requestedBy.lastName}</p>
                {request.status === "PENDING" ? (
                  <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto_auto]">
                    {canApproveRequests && canManageStockAndInvoices ? (
                      <form action={approveAndIssueMaterialRequest} className="contents">
                        <input type="hidden" name="id" value={request.id} />
                        <select
                          name="warehouseId"
                          required
                          defaultValue={warehouses[0]?.id || ""}
                          className="h-9 rounded-lg border border-[var(--border)] px-2 text-xs"
                        >
                          {warehouses.map((warehouse) => (
                            <option key={warehouse.id} value={warehouse.id}>
                              {warehouse.name}
                            </option>
                          ))}
                        </select>
                        <Button size="sm" type="submit" disabled={warehouses.length === 0}>Aproba + emite stoc</Button>
                      </form>
                    ) : (
                      <div className="text-xs text-[var(--muted)]">Emiterea din stoc este restrictionata.</div>
                    )}
                    {canApproveRequests ? (
                      <form action={approveMaterialRequest}>
                        <input type="hidden" name="id" value={request.id} />
                        <input type="hidden" name="status" value={MaterialRequestStatus.REJECTED} />
                        <Button size="sm" type="submit" variant="destructive">Respinge</Button>
                      </form>
                    ) : null}
                  </div>
                ) : null}
                {request.status === "PENDING" && warehouses.length === 0 ? (
                  <p className="mt-2 text-xs text-[#ffb7bf]">Nu exista depozite active. Configureaza depozitul pentru emitere din stoc.</p>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PermissionGuard>
  );
}
