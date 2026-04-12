import { MaterialRequestStatus } from "@prisma/client";
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
import { prisma } from "@/src/lib/prisma";
import { approveMaterialRequest, bulkMaterialRequestsAction } from "./actions";
import { MaterialRequestForm, StockMovementForm } from "./material-forms";

export default async function MaterialePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; status?: MaterialRequestStatus }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page || "1"));
  const pageSize = 20;
  const materialWhere = {
    name: params.q ? { contains: params.q, mode: "insensitive" as const } : undefined,
  };

  const [materials, totalMaterials, requests, projects, warehouses] = await Promise.all([
    prisma.material.findMany({ include: { stockMovements: true }, where: materialWhere, skip: (page - 1) * pageSize, take: pageSize, orderBy: { name: "asc" } }),
    prisma.material.count({ where: materialWhere }),
    prisma.materialRequest.findMany({ include: { material: true, project: true, requestedBy: true }, where: { status: params.status || undefined }, orderBy: { requestedAt: "desc" }, take: 50 }),
    prisma.project.findMany({ where: { deletedAt: null }, select: { id: true, title: true }, orderBy: { title: "asc" } }),
    prisma.warehouse.findMany({ where: { deletedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);
  const totalPages = Math.max(1, Math.ceil(totalMaterials / pageSize));

  return (
    <PermissionGuard resource="MATERIALS" action="VIEW">
      <div className="space-y-6">
        <PageHeader title="Materiale si stoc" subtitle="Catalog, cereri santier, consum pe proiect, miscari stoc si aprobari" />
        <div className="flex justify-end">
          <Link href="/api/export/materiale">
            <Button variant="secondary">Export Excel Materiale</Button>
          </Link>
        </div>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <h2 className="text-lg font-extrabold">Cerere materiale</h2>
            <MaterialRequestForm
              projects={projects.map((project) => ({ id: project.id, label: project.title }))}
              materials={materials.map((material) => ({ id: material.id, label: material.name }))}
            />
          </Card>

          <Card>
            <h2 className="text-lg font-extrabold">Miscare de stoc</h2>
            <StockMovementForm
              projects={projects.map((project) => ({ id: project.id, label: project.title }))}
              materials={materials.map((material) => ({ id: material.id, label: material.name }))}
              warehouses={warehouses.map((warehouse) => ({ id: warehouse.id, label: warehouse.name }))}
            />
          </Card>
        </section>

        <Card>
          <form className="mb-3 grid gap-3 md:grid-cols-3">
            <input type="hidden" name="page" value="1" />
            <Input name="q" defaultValue={params.q || ""} placeholder="Cauta material" />
            <select name="status" defaultValue={params.status || ""} className="h-10 rounded-lg border border-[#cfddd3] px-3 text-sm">
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
            <div className="overflow-x-auto">
              <Table>
                <thead><tr><TH>Cod</TH><TH>Material</TH><TH>UM</TH><TH>Stoc curent</TH><TH>Cost intern</TH><TH>Alerte</TH></tr></thead>
                <tbody>
                  {materials.map((material) => {
                    const stock = material.stockMovements.reduce((sum, move) => {
                      if (move.type === "OUT" || move.type === "WASTE") return sum - Number(move.quantity);
                      return sum + Number(move.quantity);
                    }, 0);
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
          )}
          <div className="mt-3 flex items-center justify-between text-sm text-[#5f7265]">
            <span>Pagina {page} din {totalPages}</span>
            <div className="flex gap-2">
              {page > 1 ? <Link className="rounded-md border border-[#cfdcd2] px-3 py-1" href={`/materiale?page=${page - 1}&q=${encodeURIComponent(params.q || "")}&status=${params.status || ""}`}>Anterior</Link> : null}
              {page < totalPages ? <Link className="rounded-md border border-[#cfdcd2] px-3 py-1" href={`/materiale?page=${page + 1}&q=${encodeURIComponent(params.q || "")}&status=${params.status || ""}`}>Urmator</Link> : null}
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-lg font-extrabold">Cereri materiale recente</h2>
          <form action={bulkMaterialRequestsAction} className="mt-3 space-y-3">
            <div className="grid gap-2 md:grid-cols-3">
              <select name="operation" defaultValue="APPROVE" className="h-10 rounded-lg border border-[#cfddd3] px-3 text-sm">
                <option value="APPROVE">Aproba selectie</option>
                <option value="REJECT">Respinge selectie</option>
              </select>
              <div />
              <ConfirmSubmitButton text="Executa bulk" confirmMessage="Confirmi actiunea bulk pe cererile selectate?" />
            </div>
            <div className="grid gap-1 md:grid-cols-2 rounded-lg border border-[#dce8df] p-2">
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
              <div key={request.id} className="rounded-lg border border-[#dce8df] bg-[#f7fbf8] p-3 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{request.project.title} • {request.material.name} • {request.quantity.toString()} {request.material.unitOfMeasure}</span>
                  <Badge tone={request.status === "PENDING" ? "warning" : request.status === "APPROVED" ? "success" : request.status === "REJECTED" ? "danger" : "neutral"}>{request.status}</Badge>
                </div>
                <p className="mt-1 text-xs text-[#5f7266]">Solicitant: {request.requestedBy.firstName} {request.requestedBy.lastName}</p>
                {request.status === "PENDING" ? (
                  <div className="mt-2 flex gap-2">
                    <form action={approveMaterialRequest}>
                      <input type="hidden" name="id" value={request.id} />
                      <input type="hidden" name="status" value={MaterialRequestStatus.APPROVED} />
                      <Button size="sm" type="submit">Aproba</Button>
                    </form>
                    <form action={approveMaterialRequest}>
                      <input type="hidden" name="id" value={request.id} />
                      <input type="hidden" name="status" value={MaterialRequestStatus.REJECTED} />
                      <Button size="sm" type="submit" variant="destructive">Respinge</Button>
                    </form>
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PermissionGuard>
  );
}
