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
import { prisma } from "@/src/lib/prisma";
import { approveAndIssueMaterialRequest, approveMaterialRequest, bulkMaterialRequestsAction } from "./actions";
import { MaterialCreateForm, MaterialInvoiceUploadForm, MaterialRequestForm, StockMovementForm } from "./material-forms";

export default async function MaterialePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: MaterialRequestStatus }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page || "1"));
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

  const [materials, totalMaterials, requests, projects, warehouses, materialInvoices] = await Promise.all([
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
        status: params.status || undefined,
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
        <div className="flex justify-end">
          <Link href="/api/export/materiale">
            <Button variant="secondary">Export CSV Materiale</Button>
          </Link>
        </div>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8ea2b8]">Catalog</p>
            <h2 className="mt-1 text-lg font-semibold text-[#eef8ff]">Catalog materiale</h2>
            <MaterialCreateForm />
          </Card>

          <Card>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8ea2b8]">Requests</p>
            <h2 className="mt-1 text-lg font-semibold text-[#eef8ff]">Cerere materiale</h2>
            <MaterialRequestForm
              projects={projects.map((project) => ({ id: project.id, label: project.title }))}
              materials={materials.map((material) => ({ id: material.id, label: material.name }))}
            />
          </Card>

          <Card>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8ea2b8]">Stock Flow</p>
            <h2 className="mt-1 text-lg font-semibold text-[#eef8ff]">Miscare de stoc</h2>
            {canManageStockAndInvoices ? (
              <StockMovementForm
                projects={projects.map((project) => ({ id: project.id, label: project.title }))}
                materials={materials.map((material) => ({ id: material.id, label: material.name }))}
                warehouses={warehouses.map((warehouse) => ({ id: warehouse.id, label: warehouse.name }))}
              />
            ) : (
              <p className="mt-3 text-sm text-[#9fb1c5]">Disponibil doar pentru rolurile Admin, Sef Santier si Financiar.</p>
            )}
          </Card>

          <Card>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8ea2b8]">Invoices</p>
            <h2 className="mt-1 text-lg font-semibold text-[#eef8ff]">Facturi materiale</h2>
            {canManageStockAndInvoices ? (
              <MaterialInvoiceUploadForm projects={projects.map((project) => ({ id: project.id, label: project.title }))} />
            ) : (
              <p className="mt-3 text-sm text-[#9fb1c5]">Incarcarea facturilor este disponibila doar pentru Admin, Sef Santier si Financiar.</p>
            )}
            <div className="mt-3 space-y-2">
              {materialInvoices.map((doc) => (
                <a key={doc.id} href={doc.storagePath} target="_blank" rel="noreferrer noopener" className="block rounded-lg border border-[var(--border)] p-3 text-sm hover:border-[#4f6d8f]">
                  <p className="font-semibold">{doc.title}</p>
                  <p className="text-xs text-[#9fb1c5]">{doc.project?.title || "General"} • {doc.fileName}</p>
                </a>
              ))}
            </div>
          </Card>
        </section>

        <Card>
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8ea2b8]">Filters</p>
          <form className="mb-3 mt-2 grid gap-3 md:grid-cols-3">
            <input type="hidden" name="page" value="1" />
            <Input name="q" defaultValue={params.q || ""} placeholder="Cauta material" />
            <select name="status" defaultValue={params.status || ""} className="h-10 rounded-lg border border-[var(--border)] px-3 text-sm">
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
                  <div key={material.id} className="rounded-xl border border-[var(--border)]/70 bg-[#132235] p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#e8f2ff]">{material.name}</p>
                        <p className="text-xs text-[#9fb1c5]">{material.code} • {material.unitOfMeasure}</p>
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
            <div className="hidden overflow-x-auto rounded-xl border border-[var(--border)]/70 bg-[#111c2d] md:block">
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
          <div className="mt-3 flex items-center justify-between text-sm text-[#9fb1c5]">
            <span>Pagina {page} din {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 ? <Link className="rounded-md border border-[var(--border)] px-3 py-1 hover:border-[#4f6d8f]" href={`/materiale?page=${page - 1}&q=${encodeURIComponent(params.q || "")}&status=${params.status || ""}`}>Anterior</Link> : null}
              {page < totalPages ? <Link className="rounded-md border border-[var(--border)] px-3 py-1 hover:border-[#4f6d8f]" href={`/materiale?page=${page + 1}&q=${encodeURIComponent(params.q || "")}&status=${params.status || ""}`}>Urmator</Link> : null}
            </div>
          </div>
        </Card>

        <Card className="bulk-zone">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8ea2b8]">Approval Queue</p>
          <h2 className="mt-1 text-lg font-semibold text-[#eef8ff]">Cereri materiale recente</h2>
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
          <div className="mt-3 space-y-2">
            {requests.map((request) => (
              <div key={request.id} className="rounded-lg border border-[var(--border)] bg-[#132235] p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{request.project.title} • {request.material.name} • {request.quantity.toString()} {request.material.unitOfMeasure}</span>
                  <Badge tone={request.status === "PENDING" ? "warning" : request.status === "APPROVED" ? "success" : request.status === "REJECTED" ? "danger" : "neutral"}>{request.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-[#9fb1c5]">Solicitant: {request.requestedBy.firstName} {request.requestedBy.lastName}</p>
                {request.status === "PENDING" ? (
                  <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto_auto]">
                    {canManageStockAndInvoices ? (
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
                      <div className="text-xs text-[#9fb1c5]">Emiterea din stoc este restrictionata.</div>
                    )}
                    <form action={approveMaterialRequest}>
                      <input type="hidden" name="id" value={request.id} />
                      <input type="hidden" name="status" value={MaterialRequestStatus.REJECTED} />
                      <Button size="sm" type="submit" variant="destructive">Respinge</Button>
                    </form>
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
