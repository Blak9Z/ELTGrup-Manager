import {
  InventoryAssignmentStatus,
  InventoryItemStatus,
  InventoryMovementType,
  RoleKey,
} from "@prisma/client";
import Link from "next/link";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { PageHeader } from "@/src/components/ui/page-header";
import { TD, TH, Table } from "@/src/components/ui/table";
import { auth } from "@/src/lib/auth";
import { inventoryItemScopeWhere, resolveAccessScope } from "@/src/lib/access-scope";
import { inventoryItemStatusLabels } from "@/src/lib/inventory-labels";
import { parseEnumParam } from "@/src/lib/query-params";
import { hasPermission } from "@/src/lib/rbac";
import { formatDate } from "@/src/lib/utils";
import { prisma } from "@/src/lib/prisma";
import {
  InventoryAdjustmentForm,
  InventoryCategoryForm,
  InventoryInspectionForm,
  InventoryIssueForm,
  InventoryItemForm,
  InventoryLocationForm,
  InventoryReturnForm,
} from "./inventory-forms";
import { updateInventoryItemStatusAction } from "./actions";

const assignmentStatuses: InventoryAssignmentStatus[] = [
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

const movementTone: Record<InventoryMovementType, "success" | "warning" | "danger" | "neutral" | "info"> = {
  INITIAL: "neutral",
  ISSUE: "info",
  RETURN: "success",
  ADJUSTMENT: "warning",
  TRANSFER: "neutral",
  DAMAGE: "danger",
  LOSS: "danger",
};

const availabilityFilterValues = ["all", "available", "assigned", "unassigned", "low", "inspection", "expired"] as const;

function formatQty(value: number) {
  return value.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function personName(person?: { firstName: string; lastName: string } | null) {
  return person ? `${person.firstName} ${person.lastName}` : "-";
}

function isExpiring(date?: Date | null, days = 7) {
  if (!date) return false;
  const now = new Date();
  const threshold = new Date(now);
  threshold.setDate(threshold.getDate() + days);
  return date <= threshold;
}

export default async function GestiuneSculePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; categoryId?: string; availability?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();

  const userContext = {
    id: session?.user?.id || "",
    email: session?.user?.email || null,
    roleKeys: session?.user?.roleKeys || [],
  };

  const canCreate = hasPermission(userContext.roleKeys, "MATERIALS", "CREATE", userContext.email);
  const canManage = hasPermission(userContext.roleKeys, "MATERIALS", "UPDATE", userContext.email);

  const scope = session?.user ? await resolveAccessScope(userContext) : { projectIds: null, teamId: null };
  const scopedProjectFilter = scope.projectIds === null ? null : { in: scope.projectIds.length ? scope.projectIds : ["__none__"] };

  const availability = parseEnumParam(params.availability, availabilityFilterValues) || "all";
  const where: Record<string, unknown> = {
    deletedAt: null,
    ...inventoryItemScopeWhere(userContext, scope),
  };

  if (params.q) {
    where.OR = [
      { name: { contains: params.q, mode: "insensitive" } },
      { internalCode: { contains: params.q, mode: "insensitive" } },
      { serialNumber: { contains: params.q, mode: "insensitive" } },
      { brand: { contains: params.q, mode: "insensitive" } },
      { model: { contains: params.q, mode: "insensitive" } },
    ];
  }

  if (params.categoryId) {
    where.categoryId = params.categoryId;
  }

  if (availability === "available") where.quantityAvailable = { gt: 0 };
  if (availability === "assigned") where.assignments = { some: { status: { in: assignmentStatuses } } };
  if (availability === "unassigned") where.assignments = { none: { status: { in: assignmentStatuses } } };
  if (availability === "inspection") where.nextInspectionDate = { lte: new Date(new Date().setDate(new Date().getDate() + 7)) };
  if (availability === "expired") where.expiryDate = { lte: new Date() };
  if (availability === "low") {
    where.AND = [
      { minimumStock: { not: null } },
      {
        OR: [
          { quantityAvailable: { lte: 0 } },
          {
            quantityAvailable: {
              lte: prisma.inventoryItem.fields.minimumStock,
            },
          },
        ],
      },
    ];
  }

  const [
    inventoryItems,
    categories,
    warehouses,
    locations,
    users,
    projects,
    activeAssignments,
    recentMovements,
    totalItems,
    lowStockCount,
  ] = await Promise.all([
    prisma.inventoryItem.findMany({
      where,
      include: {
        category: { select: { id: true, name: true } },
        warehouse: { select: { id: true, name: true } },
        location: { select: { id: true, name: true, code: true } },
      },
      orderBy: [{ status: "asc" }, { name: "asc" }],
      take: 250,
    }),
    prisma.inventoryCategory.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    prisma.warehouse.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
    }),
    prisma.inventoryLocation.findMany({
      where: { isActive: true },
      select: { id: true, name: true, code: true, warehouse: { select: { name: true } } },
      orderBy: [{ warehouse: { name: "asc" } }, { name: "asc" }],
      take: 300,
    }),
    prisma.user.findMany({
      where: {
        isActive: true,
        deletedAt: null,
        roles: {
          some: {
            role: {
              key: {
                notIn: [RoleKey.CLIENT_VIEWER],
              },
            },
          },
        },
      },
      select: { id: true, firstName: true, lastName: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      take: 300,
    }),
    prisma.project.findMany({
      where: {
        deletedAt: null,
        ...(scope.projectIds === null ? {} : { id: scopedProjectFilter! }),
      },
      select: { id: true, title: true },
      orderBy: [{ title: "asc" }, { id: "asc" }],
      take: 300,
    }),
    prisma.inventoryAssignment.findMany({
      where: {
        status: { in: assignmentStatuses },
        ...(scope.projectIds === null
          ? {}
          : {
              OR: [
                { issuedToUserId: userContext.id },
                { projectId: scopedProjectFilter! },
              ],
            }),
      },
      select: {
        id: true,
        itemId: true,
        quantity: true,
        issuedAt: true,
        projectId: true,
        issuedToUser: { select: { firstName: true, lastName: true } },
        project: { select: { title: true } },
        item: { select: { name: true, internalCode: true } },
      },
      orderBy: [{ issuedAt: "desc" }, { id: "asc" }],
      take: 400,
    }),
    prisma.inventoryMovement.findMany({
      where:
        scope.projectIds === null
          ? {}
          : {
              OR: [
                { projectId: scopedProjectFilter! },
                { assignment: { issuedToUserId: userContext.id } },
              ],
            },
      select: {
        id: true,
        type: true,
        quantity: true,
        movedAt: true,
        reason: true,
        item: { select: { id: true, name: true, unitOfMeasure: true } },
        project: { select: { title: true } },
      },
      orderBy: [{ movedAt: "desc" }, { id: "asc" }],
      take: 12,
    }),
    prisma.inventoryItem.count({ where: { deletedAt: null, ...inventoryItemScopeWhere(userContext, scope) } }),
    prisma.inventoryItem.count({
      where: {
        deletedAt: null,
        ...inventoryItemScopeWhere(userContext, scope),
        minimumStock: { not: null },
        OR: [
          { quantityAvailable: { lte: 0 } },
          {
            quantityAvailable: {
              lte: prisma.inventoryItem.fields.minimumStock,
            },
          },
        ],
      },
    }),
  ]);

  const activeAssignmentIds = activeAssignments.map((assignment) => assignment.id);
  const processedByAssignment =
    activeAssignmentIds.length > 0
      ? await prisma.inventoryMovement.groupBy({
          by: ["assignmentId"],
          where: {
            assignmentId: { in: activeAssignmentIds },
            type: { in: [InventoryMovementType.RETURN, InventoryMovementType.DAMAGE, InventoryMovementType.LOSS] },
          },
          _sum: { quantity: true },
        })
      : [];

  const processedQtyMap = new Map<string, number>();
  processedByAssignment.forEach((row) => {
    if (!row.assignmentId) return;
    processedQtyMap.set(row.assignmentId, Number(row._sum.quantity || 0));
  });

  const activeAssignmentsByItem = new Map<string, typeof activeAssignments>();
  const returnAssignmentOptions = activeAssignments
    .map((assignment) => {
      const assigned = Number(assignment.quantity);
      const processed = processedQtyMap.get(assignment.id) || 0;
      const outstanding = Math.max(0, assigned - processed);
      if (outstanding <= 0) return null;

      if (!activeAssignmentsByItem.has(assignment.itemId)) {
        activeAssignmentsByItem.set(assignment.itemId, []);
      }
      activeAssignmentsByItem.get(assignment.itemId)!.push(assignment);

      return {
        id: assignment.id,
        label: `${assignment.item.internalCode} • ${assignment.item.name} • ${personName(assignment.issuedToUser)} • sold ${formatQty(outstanding)}`,
      };
    })
    .filter((entry): entry is { id: string; label: string } => Boolean(entry));

  const now = new Date();

  const rows = inventoryItems.map((item) => {
    const activeRows = activeAssignmentsByItem.get(item.id) || [];
    const activeCount = activeRows.length;
    const firstHolder = activeRows[0] ? personName(activeRows[0].issuedToUser) : null;
    const quantityAvailable = Number(item.quantityAvailable);
    const quantityTotal = Number(item.quantityTotal);
    const minimumStock = Number(item.minimumStock || 0);
    const lowStock = item.minimumStock !== null && quantityAvailable <= minimumStock;
    const inspectionSoon = isExpiring(item.nextInspectionDate, 7);
    const expired = item.expiryDate ? item.expiryDate <= now : false;

    return {
      item,
      activeCount,
      firstHolder,
      quantityAvailable,
      quantityTotal,
      minimumStock,
      lowStock,
      inspectionSoon,
      expired,
    };
  });

  const lowStockRows = rows.filter((row) => row.lowStock).length;
  const inspectionAlerts = rows.filter((row) => row.inspectionSoon || row.expired).length;
  const assignedCount = rows.filter((row) => row.activeCount > 0).length;

  return (
    <PermissionGuard resource="MATERIALS" action="VIEW">
      <div className="space-y-6">
        <PageHeader
          title="Gestiune scule si depozit"
          subtitle="Catalog complet, predare/retur, corectii de stoc, istoric pe proiect si urmarirea verificarilor tehnice."
        />

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Articole in gestiune</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{totalItems}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{rows.length} afisate cu filtrele curente</p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Predate in teren</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{assignedCount}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">cu alocari active</p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Stoc sub prag</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{lowStockRows}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">total monitorizat: {lowStockCount}</p>
          </Card>
          <Card>
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Alerte valabilitate</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{inspectionAlerts}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">expirari sau verificari in 7 zile</p>
          </Card>
        </section>

        <Card>
          <form className="grid gap-3 md:grid-cols-4">
            <Input name="q" defaultValue={params.q || ""} placeholder="Cauta dupa nume, cod intern, serie, brand" />
            <select name="categoryId" defaultValue={params.categoryId || ""} className="h-11 rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 text-sm">
              <option value="">Toate categoriile</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            <select name="availability" defaultValue={availability} className="h-11 rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 text-sm">
              <option value="all">Toate</option>
              <option value="available">Disponibile</option>
              <option value="assigned">Predate</option>
              <option value="unassigned">Nepredate</option>
              <option value="low">Sub prag minim</option>
              <option value="inspection">Inspectie curand</option>
              <option value="expired">Expirate</option>
            </select>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">Filtreaza</Button>
              <Link href="/gestiune-scule" className="flex-1">
                <Button type="button" variant="secondary" className="w-full">Reseteaza</Button>
              </Link>
            </div>
          </form>
        </Card>

        <Card className="p-0">
          <div className="hidden overflow-x-auto md:block">
            <Table>
              <thead>
                <tr>
                  <TH>Articol</TH>
                  <TH>Categorie</TH>
                  <TH>Stoc</TH>
                  <TH>Predat catre</TH>
                  <TH>Valabilitate / inspectie</TH>
                  <TH>Status</TH>
                  <TH>Actiuni</TH>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.item.id}>
                    <TD>
                      <div className="space-y-1">
                        <Link href={`/gestiune-scule/${row.item.id}`} className="font-semibold text-[var(--foreground)] hover:underline">
                          {row.item.name}
                        </Link>
                        <p className="text-xs text-[var(--muted)]">
                          {row.item.internalCode}
                          {row.item.serialNumber ? ` • SN ${row.item.serialNumber}` : ""}
                        </p>
                        <p className="text-xs text-[var(--muted)]">{row.item.warehouse.name}{row.item.location ? ` • ${row.item.location.name}` : ""}</p>
                      </div>
                    </TD>
                    <TD>{row.item.category?.name || "Fara categorie"}</TD>
                    <TD>
                      <p className="font-semibold text-[var(--foreground)]">{formatQty(row.quantityAvailable)} / {formatQty(row.quantityTotal)} {row.item.unitOfMeasure}</p>
                      <p className="text-xs text-[var(--muted)]">Minim: {row.item.minimumStock !== null ? formatQty(row.minimumStock) : "-"}</p>
                    </TD>
                    <TD>
                      {row.activeCount > 0 ? (
                        <div className="space-y-1">
                          <p className="text-sm font-medium text-[var(--foreground)]">{row.firstHolder}</p>
                          <p className="text-xs text-[var(--muted)]">{row.activeCount} alocari active</p>
                        </div>
                      ) : (
                        <span className="text-sm text-[var(--muted)]">Disponibil in depozit</span>
                      )}
                    </TD>
                    <TD>
                      <div className="space-y-1 text-xs">
                        <p className="text-[var(--muted)]">Expira: {row.item.expiryDate ? formatDate(row.item.expiryDate) : "-"}</p>
                        <p className="text-[var(--muted)]">Inspectie: {row.item.nextInspectionDate ? formatDate(row.item.nextInspectionDate) : "-"}</p>
                        <div className="flex flex-wrap gap-1.5">
                          {row.lowStock ? <Badge tone="warning">Stoc mic</Badge> : null}
                          {row.expired ? <Badge tone="danger">Expirat</Badge> : null}
                          {!row.expired && row.inspectionSoon ? <Badge tone="warning">Inspectie curand</Badge> : null}
                        </div>
                      </div>
                    </TD>
                    <TD>
                      <Badge tone={statusTone[row.item.status]}>{inventoryItemStatusLabels[row.item.status]}</Badge>
                    </TD>
                    <TD>
                      <div className="flex flex-col gap-2">
                        <Link href={`/gestiune-scule/${row.item.id}`}>
                          <Button type="button" size="sm" variant="secondary" className="w-full">Detalii</Button>
                        </Link>
                        {canManage ? (
                          <form action={updateInventoryItemStatusAction}>
                            <input type="hidden" name="itemId" value={row.item.id} />
                            <div className="flex gap-2">
                              <select name="status" defaultValue={row.item.status} className="h-8 rounded-md border border-[var(--border)] px-2 text-xs">
                                {Object.values(InventoryItemStatus).map((status) => (
                                  <option key={status} value={status}>{inventoryItemStatusLabels[status]}</option>
                                ))}
                              </select>
                              <Button type="submit" size="sm">Salveaza</Button>
                            </div>
                          </form>
                        ) : null}
                      </div>
                    </TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>

          <div className="space-y-3 p-3 md:hidden">
            {rows.map((row) => (
              <div key={row.item.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[var(--foreground)]">{row.item.name}</p>
                    <p className="text-xs text-[var(--muted)]">{row.item.internalCode}</p>
                  </div>
                  <Badge tone={statusTone[row.item.status]}>{inventoryItemStatusLabels[row.item.status]}</Badge>
                </div>
                <div className="mt-2 space-y-1 text-xs text-[var(--muted)]">
                  <p>Stoc: {formatQty(row.quantityAvailable)} / {formatQty(row.quantityTotal)} {row.item.unitOfMeasure}</p>
                  <p>Categorie: {row.item.category?.name || "Fara categorie"}</p>
                  <p>Depozit: {row.item.warehouse.name}{row.item.location ? ` • ${row.item.location.name}` : ""}</p>
                  <p>Predat catre: {row.firstHolder || "-"}</p>
                </div>
                <div className="mt-3 flex gap-2">
                  <Link href={`/gestiune-scule/${row.item.id}`} className="flex-1">
                    <Button type="button" variant="secondary" className="w-full">Detalii</Button>
                  </Link>
                  {canManage ? (
                    <form action={updateInventoryItemStatusAction} className="flex-1">
                      <input type="hidden" name="itemId" value={row.item.id} />
                      <input type="hidden" name="status" value={InventoryItemStatus.AVAILABLE} />
                      <Button type="submit" className="w-full">Marcheaza disponibil</Button>
                    </form>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </Card>

        {canCreate ? (
          <section className="grid gap-4 xl:grid-cols-2">
            <Card>
              <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Catalog</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Adauga articol in gestiune</h2>
              <InventoryItemForm
                categories={categories.map((category) => ({ id: category.id, label: category.name }))}
                warehouses={warehouses.map((warehouse) => ({ id: warehouse.id, label: warehouse.name }))}
                locations={locations.map((location) => ({
                  id: location.id,
                  label: `${location.warehouse.name} • ${location.name} (${location.code})`,
                }))}
              />
            </Card>
            <div className="grid gap-4">
              <Card>
                <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Configurare</p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Categorie noua</h2>
                <InventoryCategoryForm />
              </Card>
              <Card>
                <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Configurare</p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Locatie noua in depozit</h2>
                <InventoryLocationForm
                  warehouses={warehouses.map((warehouse) => ({ id: warehouse.id, label: warehouse.name }))}
                />
              </Card>
            </div>
          </section>
        ) : null}

        {canManage ? (
          <section className="grid gap-4 xl:grid-cols-2">
            <Card>
              <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Predare</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Preda articol catre personal</h2>
              <InventoryIssueForm
                items={rows
                  .filter((row) => row.quantityAvailable > 0)
                  .map((row) => ({ id: row.item.id, label: `${row.item.internalCode} • ${row.item.name}` }))}
                users={users.map((user) => ({ id: user.id, label: `${user.firstName} ${user.lastName}` }))}
                projects={projects.map((project) => ({ id: project.id, label: project.title }))}
              />
            </Card>
            <Card>
              <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Retur</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Inregistreaza retur</h2>
              <InventoryReturnForm assignments={returnAssignmentOptions} />
            </Card>
            <Card>
              <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Corectie inventar</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Ajusteaza stoc cu motiv</h2>
              <InventoryAdjustmentForm
                items={rows.map((row) => ({ id: row.item.id, label: `${row.item.internalCode} • ${row.item.name}` }))}
              />
            </Card>
            <Card>
              <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Verificari</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Inspectie / calibrare / expirare</h2>
              <InventoryInspectionForm
                items={rows.map((row) => ({ id: row.item.id, label: `${row.item.internalCode} • ${row.item.name}` }))}
              />
            </Card>
          </section>
        ) : null}

        <Card>
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Istoric miscari</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Ultimele miscari de stoc</h2>
            </div>
            <Badge tone="neutral">{recentMovements.length} inregistrari</Badge>
          </div>
          <div className="mt-3 space-y-2">
            {recentMovements.length === 0 ? (
              <p className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-3 text-sm text-[var(--muted)]">
                Nu exista miscari inregistrate pentru filtrele de acces curente.
              </p>
            ) : null}
            {recentMovements.map((movement) => (
              <div key={movement.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold text-[var(--foreground)]">{movement.item.name}</p>
                  <Badge tone={movementTone[movement.type]}>{movementLabels[movement.type]}</Badge>
                </div>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Cantitate {formatQty(Number(movement.quantity))} {movement.item.unitOfMeasure} • {movement.project?.title || "Fara proiect"}
                </p>
                <p className="text-xs text-[var(--muted)]">{formatDate(movement.movedAt)} {movement.reason ? `• ${movement.reason}` : ""}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </PermissionGuard>
  );
}
