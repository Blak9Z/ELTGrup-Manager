"use server";

import {
  InventoryAssignmentStatus,
  InventoryCondition,
  InventoryInspectionResult,
  InventoryInspectionType,
  InventoryItemStatus,
  InventoryItemType,
  InventoryMovementType,
  NotificationType,
  RoleKey,
} from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  assertInventoryAssignmentAccess,
  assertInventoryItemAccess,
  assertProjectAccess,
} from "@/src/lib/access-scope";
import { logActivity } from "@/src/lib/activity-log";
import { ActionState, fromZodError } from "@/src/lib/action-state";
import { notifyRoles, notifyUser } from "@/src/lib/notifications";
import { requirePermission } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";

const createCategorySchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(24)
    .regex(/^[a-zA-Z0-9_-]+$/, "Codul poate contine doar litere, cifre, '-' si '_'"),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).optional(),
});

const createLocationSchema = z.object({
  warehouseId: z.string().cuid(),
  code: z
    .string()
    .trim()
    .min(2)
    .max(24)
    .regex(/^[a-zA-Z0-9_-]+$/, "Codul poate contine doar litere, cifre, '-' si '_'"),
  name: z.string().trim().min(2).max(80),
  zone: z.string().trim().max(80).optional(),
  shelf: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(500).optional(),
});

const createInventoryItemSchema = z.object({
  name: z.string().trim().min(2).max(120),
  itemType: z.nativeEnum(InventoryItemType),
  categoryId: z.string().cuid().optional(),
  warehouseId: z.string().cuid(),
  locationId: z.string().cuid().optional(),
  internalCode: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-zA-Z0-9/_-]+$/, "Codul intern poate contine doar litere, cifre, '/', '-' si '_'"),
  serialNumber: z.string().trim().max(120).optional(),
  brand: z.string().trim().max(120).optional(),
  model: z.string().trim().max(120).optional(),
  unitOfMeasure: z.string().trim().min(1).max(32),
  quantityTotal: z.coerce.number().min(0),
  quantityAvailable: z.coerce.number().min(0),
  minimumStock: z.coerce.number().min(0).optional(),
  purchaseDate: z.string().optional(),
  warrantyUntil: z.string().optional(),
  expiryDate: z.string().optional(),
  nextInspectionDate: z.string().optional(),
  notes: z.string().trim().max(1000).optional(),
  requiresReturn: z.boolean().default(true),
});

const issueInventoryItemSchema = z.object({
  itemId: z.string().cuid(),
  issuedToUserId: z.string().cuid(),
  projectId: z.string().cuid().optional(),
  quantity: z.coerce.number().positive(),
  expectedReturnAt: z.string().optional(),
  conditionAtIssue: z.nativeEnum(InventoryCondition),
  notes: z.string().trim().max(1000).optional(),
});

const returnInventoryItemSchema = z.object({
  assignmentId: z.string().cuid(),
  quantity: z.coerce.number().positive(),
  conditionAtReturn: z.nativeEnum(InventoryCondition),
  notes: z.string().trim().max(1000).optional(),
  isDamaged: z.boolean().default(false),
  isLost: z.boolean().default(false),
});

const adjustInventoryStockSchema = z.object({
  itemId: z.string().cuid(),
  quantity: z.coerce.number().positive(),
  direction: z.enum(["IN", "OUT"]),
  affectTotal: z.boolean().default(false),
  reason: z.string().trim().min(3).max(200),
  notes: z.string().trim().max(500).optional(),
});

const createInspectionSchema = z.object({
  itemId: z.string().cuid(),
  type: z.nativeEnum(InventoryInspectionType),
  result: z.nativeEnum(InventoryInspectionResult),
  performedAt: z.string().optional(),
  nextDueAt: z.string().optional(),
  notes: z.string().trim().max(1000).optional(),
});

const updateItemStatusSchema = z.object({
  itemId: z.string().cuid(),
  status: z.nativeEnum(InventoryItemStatus),
  locationId: z.string().cuid().optional(),
});

const activeAssignmentStatuses: InventoryAssignmentStatus[] = [
  InventoryAssignmentStatus.ACTIVE,
  InventoryAssignmentStatus.PARTIAL_RETURNED,
];

const warehouseManagerRoles = new Set<RoleKey>([
  RoleKey.SUPER_ADMIN,
  RoleKey.ADMINISTRATOR,
  RoleKey.BACKOFFICE,
  RoleKey.SITE_MANAGER,
  RoleKey.PROJECT_MANAGER,
]);
const blockedIssueStatuses = new Set<InventoryItemStatus>([
  InventoryItemStatus.IN_SERVICE,
  InventoryItemStatus.DAMAGED,
  InventoryItemStatus.LOST,
  InventoryItemStatus.RETIRED,
]);
const fixedStatusSet = new Set<InventoryItemStatus>([
  InventoryItemStatus.IN_SERVICE,
  InventoryItemStatus.DAMAGED,
  InventoryItemStatus.LOST,
  InventoryItemStatus.RETIRED,
]);

function parseOptionalDate(value?: string) {
  if (!value) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function parseFlag(formData: FormData, field: string) {
  const value = formData.get(field);
  return value === "on" || value === "true" || value === "1";
}

function deriveStockStatus(args: {
  quantityTotal: number;
  quantityAvailable: number;
  hasActiveAssignments: boolean;
  fallbackStatus?: InventoryItemStatus;
}) {
  const { quantityTotal, quantityAvailable, hasActiveAssignments, fallbackStatus } = args;

  if (fallbackStatus === InventoryItemStatus.IN_SERVICE) return InventoryItemStatus.IN_SERVICE;
  if (fallbackStatus === InventoryItemStatus.DAMAGED) return InventoryItemStatus.DAMAGED;
  if (fallbackStatus === InventoryItemStatus.LOST) return InventoryItemStatus.LOST;
  if (fallbackStatus === InventoryItemStatus.RETIRED) return InventoryItemStatus.RETIRED;

  if (quantityTotal <= 0) return InventoryItemStatus.RETIRED;
  if (hasActiveAssignments) return InventoryItemStatus.ASSIGNED;
  if (quantityAvailable <= 0) return InventoryItemStatus.RESERVED;
  return InventoryItemStatus.AVAILABLE;
}

async function countActiveAssignments(itemId: string) {
  return prisma.inventoryAssignment.count({
    where: {
      itemId,
      status: { in: activeAssignmentStatuses },
    },
  });
}

async function createCategoryInternal(formData: FormData) {
  const currentUser = await requirePermission("MATERIALS", "CREATE");
  const parsed = createCategorySchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    description: formData.get("description") || undefined,
  });

  if (!parsed.success) throw parsed.error;

  const category = await prisma.inventoryCategory.create({
    data: {
      code: parsed.data.code.toUpperCase(),
      name: parsed.data.name,
      description: parsed.data.description,
    },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "INVENTORY_CATEGORY",
    entityId: category.id,
    action: "INVENTORY_CATEGORY_CREATED",
  });

  revalidatePath("/gestiune-scule");
}

async function createLocationInternal(formData: FormData) {
  const currentUser = await requirePermission("MATERIALS", "CREATE");
  const parsed = createLocationSchema.safeParse({
    warehouseId: formData.get("warehouseId"),
    code: formData.get("code"),
    name: formData.get("name"),
    zone: formData.get("zone") || undefined,
    shelf: formData.get("shelf") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) throw parsed.error;

  const warehouse = await prisma.warehouse.findUnique({
    where: { id: parsed.data.warehouseId },
    select: { id: true, deletedAt: true },
  });

  if (!warehouse || warehouse.deletedAt) {
    throw new Error("Depozitul selectat nu este valid.");
  }

  const location = await prisma.inventoryLocation.create({
    data: {
      warehouseId: parsed.data.warehouseId,
      code: parsed.data.code.toUpperCase(),
      name: parsed.data.name,
      zone: parsed.data.zone,
      shelf: parsed.data.shelf,
      notes: parsed.data.notes,
    },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "INVENTORY_LOCATION",
    entityId: location.id,
    action: "INVENTORY_LOCATION_CREATED",
  });

  revalidatePath("/gestiune-scule");
}

async function createInventoryItemInternal(formData: FormData) {
  const currentUser = await requirePermission("MATERIALS", "CREATE");
  const parsed = createInventoryItemSchema.safeParse({
    name: formData.get("name"),
    itemType: formData.get("itemType"),
    categoryId: formData.get("categoryId") || undefined,
    warehouseId: formData.get("warehouseId"),
    locationId: formData.get("locationId") || undefined,
    internalCode: formData.get("internalCode"),
    serialNumber: formData.get("serialNumber") || undefined,
    brand: formData.get("brand") || undefined,
    model: formData.get("model") || undefined,
    unitOfMeasure: formData.get("unitOfMeasure"),
    quantityTotal: formData.get("quantityTotal"),
    quantityAvailable: formData.get("quantityAvailable"),
    minimumStock: formData.get("minimumStock") || undefined,
    purchaseDate: formData.get("purchaseDate") || undefined,
    warrantyUntil: formData.get("warrantyUntil") || undefined,
    expiryDate: formData.get("expiryDate") || undefined,
    nextInspectionDate: formData.get("nextInspectionDate") || undefined,
    notes: formData.get("notes") || undefined,
    requiresReturn: parseFlag(formData, "requiresReturn"),
  });

  if (!parsed.success) throw parsed.error;
  if (parsed.data.quantityAvailable > parsed.data.quantityTotal) {
    throw new Error("Stocul disponibil nu poate depasi cantitatea totala.");
  }

  const [warehouse, category, location] = await Promise.all([
    prisma.warehouse.findUnique({
      where: { id: parsed.data.warehouseId },
      select: { id: true, deletedAt: true },
    }),
    parsed.data.categoryId
      ? prisma.inventoryCategory.findUnique({ where: { id: parsed.data.categoryId }, select: { id: true, isActive: true } })
      : Promise.resolve(null),
    parsed.data.locationId
      ? prisma.inventoryLocation.findUnique({
          where: { id: parsed.data.locationId },
          select: { id: true, warehouseId: true, isActive: true },
        })
      : Promise.resolve(null),
  ]);

  if (!warehouse || warehouse.deletedAt) {
    throw new Error("Depozitul selectat nu este disponibil.");
  }
  if (parsed.data.categoryId && (!category || !category.isActive)) {
    throw new Error("Categoria selectata este invalida sau inactiva.");
  }
  if (parsed.data.locationId && (!location || !location.isActive)) {
    throw new Error("Locatia de depozit selectata este invalida sau inactiva.");
  }
  if (location && location.warehouseId !== parsed.data.warehouseId) {
    throw new Error("Locatia selectata apartine altui depozit.");
  }

  const item = await prisma.$transaction(async (tx) => {
    const created = await tx.inventoryItem.create({
      data: {
        name: parsed.data.name,
        itemType: parsed.data.itemType,
        categoryId: parsed.data.categoryId,
        warehouseId: parsed.data.warehouseId,
        locationId: parsed.data.locationId,
        internalCode: parsed.data.internalCode,
        serialNumber: parsed.data.serialNumber,
        brand: parsed.data.brand,
        model: parsed.data.model,
        unitOfMeasure: parsed.data.unitOfMeasure,
        quantityTotal: parsed.data.quantityTotal,
        quantityAvailable: parsed.data.quantityAvailable,
        minimumStock: parsed.data.minimumStock,
        status: deriveStockStatus({
          quantityTotal: parsed.data.quantityTotal,
          quantityAvailable: parsed.data.quantityAvailable,
          hasActiveAssignments: false,
        }),
        purchaseDate: parseOptionalDate(parsed.data.purchaseDate),
        warrantyUntil: parseOptionalDate(parsed.data.warrantyUntil),
        expiryDate: parseOptionalDate(parsed.data.expiryDate),
        nextInspectionDate: parseOptionalDate(parsed.data.nextInspectionDate),
        notes: parsed.data.notes,
        requiresReturn: parsed.data.itemType === InventoryItemType.CONSUMABLE ? false : parsed.data.requiresReturn,
        createdById: currentUser.id,
      },
    });

    if (parsed.data.quantityTotal > 0) {
      await tx.inventoryMovement.create({
        data: {
          itemId: created.id,
          warehouseId: created.warehouseId,
          type: InventoryMovementType.INITIAL,
          quantity: parsed.data.quantityTotal,
          performedById: currentUser.id,
          toLocationId: created.locationId,
          reason: "Stoc initial",
          notes: "Inregistrare initiala la creare articol inventar.",
        },
      });
    }

    return created;
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "INVENTORY_ITEM",
    entityId: item.id,
    action: "INVENTORY_ITEM_CREATED",
    diff: {
      itemType: item.itemType,
      warehouseId: item.warehouseId,
      quantityTotal: item.quantityTotal.toString(),
      quantityAvailable: item.quantityAvailable.toString(),
    },
  });

  revalidatePath("/gestiune-scule");
}

async function issueInventoryItemInternal(formData: FormData) {
  const currentUser = await requirePermission("MATERIALS", "UPDATE");

  const parsed = issueInventoryItemSchema.safeParse({
    itemId: formData.get("itemId"),
    issuedToUserId: formData.get("issuedToUserId"),
    projectId: formData.get("projectId") || undefined,
    quantity: formData.get("quantity"),
    expectedReturnAt: formData.get("expectedReturnAt") || undefined,
    conditionAtIssue: formData.get("conditionAtIssue"),
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) throw parsed.error;
  await assertInventoryItemAccess(currentUser, parsed.data.itemId);
  if (parsed.data.projectId) {
    await assertProjectAccess(currentUser, parsed.data.projectId);
  }

  const receiver = await prisma.user.findUnique({
    where: { id: parsed.data.issuedToUserId },
    select: { id: true, isActive: true, firstName: true, lastName: true },
  });
  if (!receiver || !receiver.isActive) {
    throw new Error("Utilizatorul selectat nu este activ.");
  }

  const issued = await prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findUnique({
      where: { id: parsed.data.itemId },
      select: {
        id: true,
        name: true,
        status: true,
        quantityAvailable: true,
        quantityTotal: true,
        minimumStock: true,
        warehouseId: true,
        locationId: true,
        deletedAt: true,
      },
    });

    if (!item || item.deletedAt) throw new Error("Articolul selectat nu exista.");
    if (blockedIssueStatuses.has(item.status)) {
      throw new Error("Articolul selectat nu poate fi predat in starea curenta.");
    }

    const available = Number(item.quantityAvailable);
    if (available < parsed.data.quantity) {
      throw new Error(`Stoc indisponibil. Disponibil: ${available.toFixed(2)}.`);
    }

    const assignment = await tx.inventoryAssignment.create({
      data: {
        itemId: item.id,
        projectId: parsed.data.projectId,
        issuedToUserId: parsed.data.issuedToUserId,
        issuedById: currentUser.id,
        quantity: parsed.data.quantity,
        expectedReturnAt: parseOptionalDate(parsed.data.expectedReturnAt),
        conditionAtIssue: parsed.data.conditionAtIssue,
        notes: parsed.data.notes,
      },
    });

    const nextAvailable = available - parsed.data.quantity;

    await tx.inventoryItem.update({
      where: { id: item.id },
      data: {
        quantityAvailable: nextAvailable,
        status: InventoryItemStatus.ASSIGNED,
      },
    });

    await tx.inventoryMovement.create({
      data: {
        itemId: item.id,
        assignmentId: assignment.id,
        warehouseId: item.warehouseId,
        projectId: parsed.data.projectId,
        performedById: currentUser.id,
        fromLocationId: item.locationId,
        type: InventoryMovementType.ISSUE,
        quantity: parsed.data.quantity,
        reason: "Predare catre personal",
        notes: parsed.data.notes,
      },
    });

    return {
      assignment,
      item,
      nextAvailable,
      minimumStock: Number(item.minimumStock || 0),
    };
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "INVENTORY_ASSIGNMENT",
    entityId: issued.assignment.id,
    action: "INVENTORY_ITEM_ISSUED",
    diff: {
      itemId: issued.item.id,
      issuedToUserId: parsed.data.issuedToUserId,
      projectId: parsed.data.projectId ?? null,
      quantity: parsed.data.quantity,
    },
  });

  await notifyUser({
    userId: parsed.data.issuedToUserId,
    type: NotificationType.NEW_ASSIGNMENT,
    title: "Scula predata",
    message: `${issued.item.name} a fost predata in cantitate ${parsed.data.quantity.toFixed(2)}.`,
    actionUrl: `/gestiune-scule/${issued.item.id}`,
  });

  if (issued.minimumStock > 0 && issued.nextAvailable <= issued.minimumStock) {
    await notifyRoles({
      roleKeys: [...warehouseManagerRoles],
      type: NotificationType.LOW_STOCK,
      title: "Stoc scule sub prag",
      message: `${issued.item.name} a ajuns la ${issued.nextAvailable.toFixed(2)} (prag ${issued.minimumStock.toFixed(2)}).`,
      actionUrl: `/gestiune-scule/${issued.item.id}`,
    });
  }

  revalidatePath("/gestiune-scule");
  if (parsed.data.projectId) revalidatePath(`/proiecte/${parsed.data.projectId}`);
}

async function returnInventoryItemInternal(formData: FormData) {
  const currentUser = await requirePermission("MATERIALS", "UPDATE");

  const parsed = returnInventoryItemSchema.safeParse({
    assignmentId: formData.get("assignmentId"),
    quantity: formData.get("quantity"),
    conditionAtReturn: formData.get("conditionAtReturn"),
    notes: formData.get("notes") || undefined,
    isDamaged: parseFlag(formData, "isDamaged"),
    isLost: parseFlag(formData, "isLost"),
  });

  if (!parsed.success) throw parsed.error;
  if (parsed.data.isDamaged && parsed.data.isLost) {
    throw new Error("Un retur nu poate fi in acelasi timp marcat si deteriorat si pierdut.");
  }

  await assertInventoryAssignmentAccess(currentUser, parsed.data.assignmentId);

  const result = await prisma.$transaction(async (tx) => {
    const assignment = await tx.inventoryAssignment.findUnique({
      where: { id: parsed.data.assignmentId },
      include: {
        item: {
          select: {
            id: true,
            name: true,
            warehouseId: true,
            locationId: true,
            quantityTotal: true,
            quantityAvailable: true,
            status: true,
          },
        },
        project: { select: { id: true } },
      },
    });

    if (!assignment) throw new Error("Alocarea selectata nu exista.");
    if (!activeAssignmentStatuses.includes(assignment.status)) {
      throw new Error("Alocarea nu mai este activa.");
    }

    if (assignment.projectId) {
      await assertProjectAccess(currentUser, assignment.projectId);
    }

    const alreadyProcessed = await tx.inventoryMovement.aggregate({
      where: {
        assignmentId: assignment.id,
        type: { in: [InventoryMovementType.RETURN, InventoryMovementType.DAMAGE, InventoryMovementType.LOSS] },
      },
      _sum: { quantity: true },
    });

    const processedQty = Number(alreadyProcessed._sum.quantity || 0);
    const assignedQty = Number(assignment.quantity);
    const remainingQty = assignedQty - processedQty;

    if (remainingQty <= 0) {
      throw new Error("Alocarea este deja inchisa.");
    }
    if (parsed.data.quantity > remainingQty) {
      throw new Error(`Cantitatea de retur depaseste soldul activ (${remainingQty.toFixed(2)}).`);
    }

    const itemTotal = Number(assignment.item.quantityTotal);
    const itemAvailable = Number(assignment.item.quantityAvailable);
    let nextTotal = itemTotal;
    let nextAvailable = itemAvailable;

    let movementType: InventoryMovementType = InventoryMovementType.RETURN;
    let movementReason = "Retur in depozit";

    if (parsed.data.isLost) {
      movementType = InventoryMovementType.LOSS;
      movementReason = "Marcat pierdut la retur";
      nextTotal = itemTotal - parsed.data.quantity;
      if (nextTotal < 0) {
        throw new Error("Nu poti marca pierduta o cantitate mai mare decat totalul articolului.");
      }
    } else if (parsed.data.isDamaged) {
      movementType = InventoryMovementType.DAMAGE;
      movementReason = "Retur cu defect";
    } else {
      nextAvailable = itemAvailable + parsed.data.quantity;
      if (nextAvailable > itemTotal) {
        throw new Error("Returul depaseste cantitatea totala inregistrata.");
      }
    }

    await tx.inventoryMovement.create({
      data: {
        itemId: assignment.itemId,
        assignmentId: assignment.id,
        warehouseId: assignment.item.warehouseId,
        projectId: assignment.projectId,
        performedById: currentUser.id,
        toLocationId: assignment.item.locationId,
        type: movementType,
        quantity: parsed.data.quantity,
        reason: movementReason,
        notes: parsed.data.notes,
      },
    });

    const newProcessedQty = processedQty + parsed.data.quantity;
    const stillRemaining = assignedQty - newProcessedQty;

    let nextAssignmentStatus = assignment.status;
    if (stillRemaining <= 0) {
      nextAssignmentStatus = parsed.data.isLost ? InventoryAssignmentStatus.LOST : InventoryAssignmentStatus.RETURNED;
    } else {
      nextAssignmentStatus = InventoryAssignmentStatus.PARTIAL_RETURNED;
    }

    await tx.inventoryAssignment.update({
      where: { id: assignment.id },
      data: {
        status: nextAssignmentStatus,
        returnedById: stillRemaining <= 0 ? currentUser.id : null,
        returnedAt: stillRemaining <= 0 ? new Date() : null,
        conditionAtReturn: parsed.data.conditionAtReturn,
        returnNotes: parsed.data.notes,
        isDamaged: assignment.isDamaged || parsed.data.isDamaged,
        isLost: assignment.isLost || parsed.data.isLost,
      },
    });

    const activeAssignmentsCount = await tx.inventoryAssignment.count({
      where: {
        itemId: assignment.itemId,
        status: { in: activeAssignmentStatuses },
      },
    });

    let nextStatus = deriveStockStatus({
      quantityTotal: nextTotal,
      quantityAvailable: nextAvailable,
      hasActiveAssignments: activeAssignmentsCount > 0,
    });

    if (parsed.data.isDamaged && activeAssignmentsCount === 0) {
      nextStatus = InventoryItemStatus.DAMAGED;
    }
    if (parsed.data.isLost && nextTotal <= 0) {
      nextStatus = InventoryItemStatus.LOST;
    }

    await tx.inventoryItem.update({
      where: { id: assignment.itemId },
      data: {
        quantityTotal: nextTotal,
        quantityAvailable: nextAvailable,
        status: nextStatus,
      },
    });

    return {
      itemId: assignment.itemId,
      itemName: assignment.item.name,
      projectId: assignment.projectId,
      issuedToUserId: assignment.issuedToUserId,
      quantity: parsed.data.quantity,
    };
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "INVENTORY_ASSIGNMENT",
    entityId: parsed.data.assignmentId,
    action: "INVENTORY_ITEM_RETURNED",
    diff: {
      quantity: parsed.data.quantity,
      isDamaged: parsed.data.isDamaged,
      isLost: parsed.data.isLost,
      conditionAtReturn: parsed.data.conditionAtReturn,
    },
  });

  await notifyUser({
    userId: result.issuedToUserId,
    type: NotificationType.NEW_ASSIGNMENT,
    title: "Retur inregistrat",
    message: `Retur pentru ${result.itemName}: ${result.quantity.toFixed(2)} inregistrat in depozit.`,
    actionUrl: `/gestiune-scule/${result.itemId}`,
  });

  revalidatePath("/gestiune-scule");
  revalidatePath(`/gestiune-scule/${result.itemId}`);
  if (result.projectId) revalidatePath(`/proiecte/${result.projectId}`);
}

async function adjustInventoryStockInternal(formData: FormData) {
  const currentUser = await requirePermission("MATERIALS", "UPDATE");

  const parsed = adjustInventoryStockSchema.safeParse({
    itemId: formData.get("itemId"),
    quantity: formData.get("quantity"),
    direction: formData.get("direction"),
    affectTotal: parseFlag(formData, "affectTotal"),
    reason: formData.get("reason"),
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) throw parsed.error;
  await assertInventoryItemAccess(currentUser, parsed.data.itemId);

  const adjustment = await prisma.$transaction(async (tx) => {
    const item = await tx.inventoryItem.findUnique({
      where: { id: parsed.data.itemId },
      select: {
        id: true,
        name: true,
        warehouseId: true,
        locationId: true,
        quantityTotal: true,
        quantityAvailable: true,
        minimumStock: true,
      },
    });
    if (!item) throw new Error("Articolul selectat nu exista.");

    const currentTotal = Number(item.quantityTotal);
    const currentAvailable = Number(item.quantityAvailable);

    let nextTotal = currentTotal;
    let nextAvailable = currentAvailable;

    if (parsed.data.direction === "IN") {
      nextAvailable += parsed.data.quantity;
      if (parsed.data.affectTotal) {
        nextTotal += parsed.data.quantity;
      }
      if (nextAvailable > nextTotal) {
        throw new Error("Corectia depaseste cantitatea totala. Bifeaza 'Ajusteaza si total' daca adaugi stoc nou.");
      }
    } else {
      if (currentAvailable < parsed.data.quantity) {
        throw new Error(`Stoc disponibil insuficient (${currentAvailable.toFixed(2)}).`);
      }
      nextAvailable -= parsed.data.quantity;
      if (parsed.data.affectTotal) {
        if (currentTotal < parsed.data.quantity) {
          throw new Error("Nu poti scadea totalul sub zero.");
        }
        nextTotal -= parsed.data.quantity;
      }
    }

    const activeAssignmentsCount = await tx.inventoryAssignment.count({
      where: { itemId: item.id, status: { in: activeAssignmentStatuses } },
    });

    const nextStatus = deriveStockStatus({
      quantityTotal: nextTotal,
      quantityAvailable: nextAvailable,
      hasActiveAssignments: activeAssignmentsCount > 0,
    });

    await tx.inventoryItem.update({
      where: { id: item.id },
      data: {
        quantityTotal: nextTotal,
        quantityAvailable: nextAvailable,
        status: nextStatus,
      },
    });

    await tx.inventoryMovement.create({
      data: {
        itemId: item.id,
        warehouseId: item.warehouseId,
        performedById: currentUser.id,
        toLocationId: parsed.data.direction === "IN" ? item.locationId : null,
        fromLocationId: parsed.data.direction === "OUT" ? item.locationId : null,
        type: InventoryMovementType.ADJUSTMENT,
        quantity: parsed.data.quantity,
        reason: `${parsed.data.direction === "IN" ? "Plus" : "Minus"}: ${parsed.data.reason}`,
        notes: parsed.data.notes,
      },
    });

    return {
      item,
      nextAvailable,
      minimumStock: Number(item.minimumStock || 0),
    };
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "INVENTORY_ITEM",
    entityId: parsed.data.itemId,
    action: "INVENTORY_STOCK_ADJUSTED",
    diff: {
      quantity: parsed.data.quantity,
      direction: parsed.data.direction,
      affectTotal: parsed.data.affectTotal,
      reason: parsed.data.reason,
    },
  });

  if (adjustment.minimumStock > 0 && adjustment.nextAvailable <= adjustment.minimumStock) {
    await notifyRoles({
      roleKeys: [...warehouseManagerRoles],
      type: NotificationType.LOW_STOCK,
      title: "Stoc scule sub prag",
      message: `${adjustment.item.name} a ajuns la ${adjustment.nextAvailable.toFixed(2)} (prag ${adjustment.minimumStock.toFixed(2)}).`,
      actionUrl: `/gestiune-scule/${adjustment.item.id}`,
    });
  }

  revalidatePath("/gestiune-scule");
  revalidatePath(`/gestiune-scule/${parsed.data.itemId}`);
}

async function createInspectionInternal(formData: FormData) {
  const currentUser = await requirePermission("MATERIALS", "UPDATE");

  const parsed = createInspectionSchema.safeParse({
    itemId: formData.get("itemId"),
    type: formData.get("type"),
    result: formData.get("result"),
    performedAt: formData.get("performedAt") || undefined,
    nextDueAt: formData.get("nextDueAt") || undefined,
    notes: formData.get("notes") || undefined,
  });

  if (!parsed.success) throw parsed.error;
  await assertInventoryItemAccess(currentUser, parsed.data.itemId);

  const performedAt = parseOptionalDate(parsed.data.performedAt) || new Date();
  const nextDueAt = parseOptionalDate(parsed.data.nextDueAt);

  const inspection = await prisma.$transaction(async (tx) => {
    const created = await tx.inventoryInspectionRecord.create({
      data: {
        itemId: parsed.data.itemId,
        performedById: currentUser.id,
        type: parsed.data.type,
        result: parsed.data.result,
        performedAt,
        nextDueAt,
        notes: parsed.data.notes,
      },
    });

    const item = await tx.inventoryItem.findUnique({
      where: { id: parsed.data.itemId },
      select: {
        id: true,
        quantityTotal: true,
        quantityAvailable: true,
      },
    });

    if (item) {
      const activeAssignmentsCount = await tx.inventoryAssignment.count({
        where: { itemId: item.id, status: { in: activeAssignmentStatuses } },
      });
      const baseStatus = deriveStockStatus({
        quantityTotal: Number(item.quantityTotal),
        quantityAvailable: Number(item.quantityAvailable),
        hasActiveAssignments: activeAssignmentsCount > 0,
      });
      const status =
        parsed.data.result === InventoryInspectionResult.PASS ? baseStatus : InventoryItemStatus.IN_SERVICE;

      await tx.inventoryItem.update({
        where: { id: item.id },
        data: {
          inspectionDate: performedAt,
          nextInspectionDate: nextDueAt,
          status,
        },
      });
    }

    return created;
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "INVENTORY_INSPECTION",
    entityId: inspection.id,
    action: "INVENTORY_INSPECTION_CREATED",
    diff: {
      itemId: parsed.data.itemId,
      type: parsed.data.type,
      result: parsed.data.result,
      nextDueAt: nextDueAt?.toISOString() || null,
    },
  });

  revalidatePath("/gestiune-scule");
  revalidatePath(`/gestiune-scule/${parsed.data.itemId}`);
}

async function updateInventoryItemStatusInternal(formData: FormData) {
  const currentUser = await requirePermission("MATERIALS", "UPDATE");

  const parsed = updateItemStatusSchema.safeParse({
    itemId: formData.get("itemId"),
    status: formData.get("status"),
    locationId: formData.get("locationId") || undefined,
  });

  if (!parsed.success) throw parsed.error;
  await assertInventoryItemAccess(currentUser, parsed.data.itemId);

  const item = await prisma.inventoryItem.findUnique({
    where: { id: parsed.data.itemId },
    select: { id: true, warehouseId: true },
  });
  if (!item) throw new Error("Articolul selectat nu exista.");

  if (parsed.data.locationId) {
    const location = await prisma.inventoryLocation.findUnique({
      where: { id: parsed.data.locationId },
      select: { id: true, warehouseId: true, isActive: true },
    });

    if (!location || !location.isActive || location.warehouseId !== item.warehouseId) {
      throw new Error("Locatia selectata este invalida pentru acest depozit.");
    }
  }

  await prisma.inventoryItem.update({
    where: { id: item.id },
    data: {
      status: parsed.data.status,
      locationId: parsed.data.locationId,
    },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "INVENTORY_ITEM",
    entityId: item.id,
    action: "INVENTORY_STATUS_UPDATED",
    diff: {
      status: parsed.data.status,
      locationId: parsed.data.locationId ?? null,
    },
  });

  revalidatePath("/gestiune-scule");
  revalidatePath(`/gestiune-scule/${item.id}`);
}

export async function createInventoryCategoryAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await createCategoryInternal(formData);
    return { ok: true, message: "Categoria a fost adaugata." };
  } catch (error) {
    if (error instanceof z.ZodError) return fromZodError(error);
    return { ok: false, message: error instanceof Error ? error.message : "Eroare la creare categorie." };
  }
}

export async function createInventoryLocationAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await createLocationInternal(formData);
    return { ok: true, message: "Locatia de depozit a fost adaugata." };
  } catch (error) {
    if (error instanceof z.ZodError) return fromZodError(error);
    return { ok: false, message: error instanceof Error ? error.message : "Eroare la creare locatie." };
  }
}

export async function createInventoryItemAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await createInventoryItemInternal(formData);
    return { ok: true, message: "Articolul a fost adaugat in gestiune." };
  } catch (error) {
    if (error instanceof z.ZodError) return fromZodError(error);
    return { ok: false, message: error instanceof Error ? error.message : "Eroare la creare articol." };
  }
}

export async function issueInventoryItemAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await issueInventoryItemInternal(formData);
    return { ok: true, message: "Predarea a fost inregistrata." };
  } catch (error) {
    if (error instanceof z.ZodError) return fromZodError(error);
    return { ok: false, message: error instanceof Error ? error.message : "Eroare la predare." };
  }
}

export async function returnInventoryItemAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await returnInventoryItemInternal(formData);
    return { ok: true, message: "Returul a fost inregistrat." };
  } catch (error) {
    if (error instanceof z.ZodError) return fromZodError(error);
    return { ok: false, message: error instanceof Error ? error.message : "Eroare la retur." };
  }
}

export async function adjustInventoryStockAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await adjustInventoryStockInternal(formData);
    return { ok: true, message: "Corectia de stoc a fost aplicata." };
  } catch (error) {
    if (error instanceof z.ZodError) return fromZodError(error);
    return { ok: false, message: error instanceof Error ? error.message : "Eroare la corectia de stoc." };
  }
}

export async function createInventoryInspectionAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await createInspectionInternal(formData);
    return { ok: true, message: "Inregistrarea de verificare a fost salvata." };
  } catch (error) {
    if (error instanceof z.ZodError) return fromZodError(error);
    return { ok: false, message: error instanceof Error ? error.message : "Eroare la salvarea verificarii." };
  }
}

export async function updateInventoryItemStatusAction(formData: FormData) {
  await updateInventoryItemStatusInternal(formData);
}

export async function refreshInventoryItemStatus(itemId: string) {
  const item = await prisma.inventoryItem.findUnique({
    where: { id: itemId },
    select: { id: true, quantityTotal: true, quantityAvailable: true, status: true },
  });
  if (!item) return;

  const activeCount = await countActiveAssignments(item.id);
  const nextStatus = deriveStockStatus({
    quantityTotal: Number(item.quantityTotal),
    quantityAvailable: Number(item.quantityAvailable),
    hasActiveAssignments: activeCount > 0,
    fallbackStatus: fixedStatusSet.has(item.status) ? item.status : undefined,
  });

  if (nextStatus !== item.status) {
    await prisma.inventoryItem.update({
      where: { id: item.id },
      data: { status: nextStatus },
    });
  }
}
