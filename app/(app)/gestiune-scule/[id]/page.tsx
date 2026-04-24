import {
  InventoryAssignmentStatus,
  InventoryItemStatus,
  InventoryMovementType,
} from "@prisma/client";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { PageHeader } from "@/src/components/ui/page-header";
import { auth } from "@/src/lib/auth";
import { assertInventoryItemAccess } from "@/src/lib/access-scope";
import {
  inventoryAssignmentStatusLabels,
  inventoryInspectionResultLabels,
  inventoryInspectionTypeLabels,
  inventoryItemStatusLabels,
  inventoryItemTypeLabels,
} from "@/src/lib/inventory-labels";
import { hasPermission } from "@/src/lib/rbac";
import { formatDate } from "@/src/lib/utils";
import { prisma } from "@/src/lib/prisma";
import {
  InventoryAdjustmentForm,
  InventoryInspectionForm,
  InventoryReturnForm,
} from "../inventory-forms";
import { updateInventoryItemStatusAction } from "../actions";

const activeStatuses: InventoryAssignmentStatus[] = [
  InventoryAssignmentStatus.ACTIVE,
  InventoryAssignmentStatus.PARTIAL_RETURNED,
];

const statusTone: Record<InventoryItemStatus, "success" | "warning" | "danger" | "neutral" | "info"> = {
  AVAILABLE: "success",
  ASSIGNED: "info",
  RESERVED: "warning",
  IN_SERVICE: "warning",
  DAMAGED: "danger",
  LOST: "danger",
  RETIRED: "neutral",
};

const movementLabels: Record<InventoryMovementType, string> = {
  INITIAL: "Stoc initial",
  ISSUE: "Predare",
  RETURN: "Retur",
  ADJUSTMENT: "Corectie",
  TRANSFER: "Transfer",
  DAMAGE: "Defect",
  LOSS: "Pierdere",
};

function formatQty(value: number) {
  return value.toLocaleString("ro-RO", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function personName(person?: { firstName: string; lastName: string } | null) {
  return person ? `${person.firstName} ${person.lastName}` : "-";
}

export default async function InventoryItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();

  if (session?.user) {
    await assertInventoryItemAccess(
      {
        id: session.user.id,
        email: session.user.email,
        roleKeys: session.user.roleKeys || [],
      },
      id,
    ).catch(() => notFound());
  }

  const canManage = hasPermission(session?.user?.roleKeys || [], "MATERIALS", "UPDATE", session?.user?.email || null);

  const item = await prisma.inventoryItem.findUnique({
    where: { id, deletedAt: null },
    include: {
      category: { select: { name: true } },
      warehouse: { select: { name: true } },
      location: { select: { name: true, code: true } },
      createdBy: { select: { firstName: true, lastName: true } },
      assignments: {
        include: {
          project: { select: { id: true, title: true } },
          issuedToUser: { select: { firstName: true, lastName: true } },
          issuedBy: { select: { firstName: true, lastName: true } },
          returnedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ issuedAt: "desc" }, { id: "asc" }],
        take: 100,
      },
      movements: {
        include: {
          project: { select: { title: true } },
          performedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ movedAt: "desc" }, { id: "asc" }],
        take: 120,
      },
      inspections: {
        include: {
          performedBy: { select: { firstName: true, lastName: true } },
        },
        orderBy: [{ performedAt: "desc" }, { id: "asc" }],
        take: 80,
      },
    },
  });

  if (!item) notFound();

  const assignmentIds = item.assignments.map((assignment) => assignment.id);
  const processedByAssignment =
    assignmentIds.length > 0
      ? await prisma.inventoryMovement.groupBy({
          by: ["assignmentId"],
          where: {
            assignmentId: { in: assignmentIds },
            type: { in: [InventoryMovementType.RETURN, InventoryMovementType.DAMAGE, InventoryMovementType.LOSS] },
          },
          _sum: { quantity: true },
        })
      : [];

  const processedMap = new Map<string, number>();
  processedByAssignment.forEach((row) => {
    if (row.assignmentId) processedMap.set(row.assignmentId, Number(row._sum.quantity || 0));
  });

  const assignmentRows = item.assignments.map((assignment) => {
    const quantity = Number(assignment.quantity);
    const processed = processedMap.get(assignment.id) || 0;
    const outstanding = Math.max(0, quantity - processed);
    return {
      assignment,
      quantity,
      processed,
      outstanding,
    };
  });

  const activeAssignments = assignmentRows.filter((row) => activeStatuses.includes(row.assignment.status) && row.outstanding > 0);
  const closedAssignments = assignmentRows.filter((row) => !activeStatuses.includes(row.assignment.status) || row.outstanding <= 0);

  const returnOptions = activeAssignments.map((row) => ({
    id: row.assignment.id,
    label: `${personName(row.assignment.issuedToUser)} • ${row.assignment.project?.title || "Fara proiect"} • sold ${formatQty(row.outstanding)}`,
  }));

  return (
    <PermissionGuard resource="MATERIALS" action="VIEW">
      <div className="space-y-6">
        <PageHeader
          title={item.name}
          subtitle={`${item.internalCode} • ${item.category?.name || "Fara categorie"} • ${item.warehouse.name}${item.location ? ` • ${item.location.name}` : ""}`}
          actions={
            <div className="flex flex-wrap gap-2">
              <Link href="/gestiune-scule">
                <Button type="button" variant="secondary">Inapoi la gestiune</Button>
              </Link>
            </div>
          }
        />

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Status</p>
            <div className="mt-2">
              <Badge tone={statusTone[item.status]}>{inventoryItemStatusLabels[item.status]}</Badge>
            </div>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Stoc disponibil</p>
            <p className="mt-2 text-xl font-semibold text-[var(--foreground)]">{formatQty(Number(item.quantityAvailable))} {item.unitOfMeasure}</p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Cantitate totala</p>
            <p className="mt-2 text-xl font-semibold text-[var(--foreground)]">{formatQty(Number(item.quantityTotal))} {item.unitOfMeasure}</p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Alocari active</p>
            <p className="mt-2 text-xl font-semibold text-[var(--foreground)]">{activeAssignments.length}</p>
          </Card>
        </section>

        <section className="grid gap-4 xl:grid-cols-3">
          <Card>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Date articol</h2>
            <div className="mt-3 space-y-2 text-sm text-[var(--muted-strong)]">
              <p>Tip: {inventoryItemTypeLabels[item.itemType]}</p>
              <p>Serie: {item.serialNumber || "-"}</p>
              <p>Brand/Model: {[item.brand, item.model].filter(Boolean).join(" / ") || "-"}</p>
              <p>Depozit: {item.warehouse.name}</p>
              <p>Locatie: {item.location ? `${item.location.name} (${item.location.code})` : "-"}</p>
              <p>Stoc minim: {item.minimumStock !== null ? formatQty(Number(item.minimumStock)) : "-"}</p>
              <p>Necesita retur: {item.requiresReturn ? "Da" : "Nu"}</p>
              <p>Creat de: {personName(item.createdBy)}</p>
              <p>Creat la: {formatDate(item.createdAt)}</p>
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Valabilitate si verificari</h2>
            <div className="mt-3 space-y-2 text-sm text-[var(--muted-strong)]">
              <p>Achizitie: {item.purchaseDate ? formatDate(item.purchaseDate) : "-"}</p>
              <p>Garantie: {item.warrantyUntil ? formatDate(item.warrantyUntil) : "-"}</p>
              <p>Expirare: {item.expiryDate ? formatDate(item.expiryDate) : "-"}</p>
              <p>Ultima inspectie: {item.inspectionDate ? formatDate(item.inspectionDate) : "-"}</p>
              <p>Urmatoare inspectie: {item.nextInspectionDate ? formatDate(item.nextInspectionDate) : "-"}</p>
              {item.notes ? <p>Note: {item.notes}</p> : null}
            </div>
          </Card>

          {canManage ? (
            <Card>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Status operational</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Actualizeaza statusul cand articolul intra in service, e retras sau revine disponibil.</p>
              <form action={updateInventoryItemStatusAction} className="mt-3 space-y-3">
                <input type="hidden" name="itemId" value={item.id} />
                <select name="status" defaultValue={item.status} className="h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 text-sm">
                  {Object.values(InventoryItemStatus).map((status) => (
                    <option key={status} value={status}>
                      {inventoryItemStatusLabels[status]}
                    </option>
                  ))}
                </select>
                <Button type="submit" className="w-full">Actualizeaza status</Button>
              </form>
            </Card>
          ) : null}
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Alocari active</h2>
              <Badge tone="info">{activeAssignments.length}</Badge>
            </div>
            <div className="mt-3 space-y-2">
              {activeAssignments.length === 0 ? (
                <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-3 text-sm text-[var(--muted)]">
                  Articolul nu este predat in acest moment.
                </p>
              ) : null}
              {activeAssignments.map((row) => (
                <div key={row.assignment.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-3 text-sm">
                  <p className="font-semibold text-[var(--foreground)]">{personName(row.assignment.issuedToUser)}</p>
                  <p className="text-xs text-[var(--muted)]">Proiect: {row.assignment.project?.title || "Fara proiect"}</p>
                  <p className="text-xs text-[var(--muted)]">Predat: {formatDate(row.assignment.issuedAt)} de {personName(row.assignment.issuedBy)}</p>
                  <p className="text-xs text-[var(--muted)]">Cantitate: {formatQty(row.quantity)} • Sold: {formatQty(row.outstanding)} {item.unitOfMeasure}</p>
                  <p className="text-xs text-[var(--muted)]">Retur estimat: {row.assignment.expectedReturnAt ? formatDate(row.assignment.expectedReturnAt) : "-"}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">Istoric alocari</h2>
              <Badge tone="neutral">{closedAssignments.length}</Badge>
            </div>
            <div className="mt-3 space-y-2">
              {closedAssignments.length === 0 ? (
                <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-3 text-sm text-[var(--muted)]">
                  Nu exista alocari inchise inca.
                </p>
              ) : null}
              {closedAssignments.map((row) => (
                <div key={row.assignment.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-semibold text-[var(--foreground)]">{personName(row.assignment.issuedToUser)}</p>
                    <Badge tone="neutral">{inventoryAssignmentStatusLabels[row.assignment.status]}</Badge>
                  </div>
                  <p className="text-xs text-[var(--muted)]">Predat {formatDate(row.assignment.issuedAt)} • Retur {row.assignment.returnedAt ? formatDate(row.assignment.returnedAt) : "-"}</p>
                  <p className="text-xs text-[var(--muted)]">Cantitate: {formatQty(row.quantity)} • Procesat: {formatQty(row.processed)}</p>
                  <p className="text-xs text-[var(--muted)]">Observatii retur: {row.assignment.returnNotes || "-"}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>

        {canManage ? (
          <section className="grid gap-4 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Retur rapid</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Inchide alocare direct din articol</h2>
              <InventoryReturnForm assignments={returnOptions} />
            </Card>
            <Card>
              <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Corectie stoc</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Ajustare inventar</h2>
              <InventoryAdjustmentForm items={[{ id: item.id, label: `${item.internalCode} • ${item.name}` }]} />
            </Card>
            <Card className="xl:col-span-3">
              <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Inspectie</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Inregistreaza verificare tehnica</h2>
              <InventoryInspectionForm items={[{ id: item.id, label: `${item.internalCode} • ${item.name}` }]} />
            </Card>
          </section>
        ) : null}

        <section className="grid gap-4 xl:grid-cols-2">
          <Card>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Istoric miscari stoc</h2>
            <div className="mt-3 space-y-2">
              {item.movements.length === 0 ? (
                <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-3 text-sm text-[var(--muted)]">Nu exista miscari pentru acest articol.</p>
              ) : null}
              {item.movements.map((movement) => (
                <div key={movement.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-[var(--foreground)]">{movementLabels[movement.type]}</p>
                    <p className="text-xs text-[var(--muted)]">{formatDate(movement.movedAt)}</p>
                  </div>
                  <p className="text-xs text-[var(--muted)]">Cantitate {formatQty(Number(movement.quantity))} {item.unitOfMeasure}</p>
                  <p className="text-xs text-[var(--muted)]">Proiect: {movement.project?.title || "-"}</p>
                  <p className="text-xs text-[var(--muted)]">Operator: {personName(movement.performedBy)}</p>
                  <p className="text-xs text-[var(--muted)]">Motiv: {movement.reason || "-"}</p>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Istoric verificari</h2>
            <div className="mt-3 space-y-2">
              {item.inspections.length === 0 ? (
                <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-3 text-sm text-[var(--muted)]">Nu exista verificari inregistrate.</p>
              ) : null}
              {item.inspections.map((inspection) => (
                <div key={inspection.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-3 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-semibold text-[var(--foreground)]">{inventoryInspectionTypeLabels[inspection.type]}</p>
                    <Badge tone={inspection.result === "PASS" ? "success" : inspection.result === "NEEDS_SERVICE" ? "warning" : "danger"}>
                      {inventoryInspectionResultLabels[inspection.result]}
                    </Badge>
                  </div>
                  <p className="text-xs text-[var(--muted)]">Data: {formatDate(inspection.performedAt)}</p>
                  <p className="text-xs text-[var(--muted)]">Urmatoare: {inspection.nextDueAt ? formatDate(inspection.nextDueAt) : "-"}</p>
                  <p className="text-xs text-[var(--muted)]">Operator: {personName(inspection.performedBy)}</p>
                  <p className="text-xs text-[var(--muted)]">Note: {inspection.notes || "-"}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </PermissionGuard>
  );
}
