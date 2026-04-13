"use server";

import { MaterialRequestStatus, NotificationType, RoleKey, StockMovementType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertProjectAccess, resolveAccessScope } from "@/src/lib/access-scope";
import { logActivity } from "@/src/lib/activity-log";
import { ActionState, fromZodError } from "@/src/lib/action-state";
import { notifyRoles, notifyUser } from "@/src/lib/notifications";
import { requirePermission } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";
import { uploadDocumentFile } from "@/src/lib/storage";

const requestSchema = z.object({
  projectId: z.string().cuid(),
  materialId: z.string().cuid(),
  quantity: z.coerce.number().positive(),
  note: z.string().max(500).optional(),
});

const movementSchema = z.object({
  materialId: z.string().cuid(),
  warehouseId: z.string().cuid(),
  projectId: z.string().cuid().optional(),
  quantity: z.coerce.number().positive(),
  type: z.nativeEnum(StockMovementType),
  note: z.string().max(500).optional(),
});

const approveAndIssueSchema = z.object({
  id: z.string().cuid(),
  warehouseId: z.string().cuid(),
});

const createMaterialSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  unitOfMeasure: z.string().min(1),
  category: z.string().optional(),
  internalCost: z.coerce.number().min(0).optional(),
  minStockLevel: z.coerce.number().min(0).optional(),
  supplierName: z.string().optional(),
});

const stockAndInvoiceAllowedRoles = new Set<RoleKey>([
  RoleKey.SUPER_ADMIN,
  RoleKey.ADMINISTRATOR,
  RoleKey.SITE_MANAGER,
  RoleKey.ACCOUNTANT,
]);

function ensureStockAndInvoiceAccess(roleKeys: RoleKey[]) {
  if (roleKeys.some((role) => stockAndInvoiceAllowedRoles.has(role))) return;
  throw new Error("Doar Admin, Sef Santier sau Financiar pot opera miscari de stoc si facturi materiale.");
}

async function createMaterialRequestInternal(formData: FormData) {
  const currentUser = await requirePermission("MATERIALS", "CREATE");

  const parsed = requestSchema.safeParse({
    projectId: formData.get("projectId"),
    materialId: formData.get("materialId"),
    quantity: formData.get("quantity"),
    note: formData.get("note") || undefined,
  });

  if (!parsed.success) throw parsed.error;
  await assertProjectAccess(currentUser, parsed.data.projectId);

  const request = await prisma.materialRequest.create({
    data: {
      projectId: parsed.data.projectId,
      materialId: parsed.data.materialId,
      quantity: parsed.data.quantity,
      note: parsed.data.note,
      requestedById: currentUser.id,
    },
    include: { material: true, project: true },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "MATERIAL_REQUEST",
    entityId: request.id,
    action: "MATERIAL_REQUEST_CREATED",
    diff: { quantity: request.quantity.toString(), projectId: request.projectId },
  });

  await notifyRoles({
    roleKeys: [RoleKey.SITE_MANAGER, RoleKey.PROJECT_MANAGER, RoleKey.BACKOFFICE],
    type: NotificationType.MATERIAL_REQUEST_APPROVAL_REQUIRED,
    title: "Cerere materiale noua",
    message: `${request.project.title}: ${request.material.name} (${request.quantity.toString()})`,
    actionUrl: "/materiale",
  });

  revalidatePath("/materiale");
  revalidatePath("/panou");
}

export async function createMaterialRequestAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await createMaterialRequestInternal(formData);
    return { ok: true, message: "Cererea de materiale a fost trimisa." };
  } catch (error) {
    if (error instanceof z.ZodError) return fromZodError(error);
    return { ok: false, message: error instanceof Error ? error.message : "Eroare la creare cerere" };
  }
}

export async function approveMaterialRequest(formData: FormData) {
  const currentUser = await requirePermission("MATERIALS", "APPROVE");

  const id = String(formData.get("id"));
  const status = String(formData.get("status"));
  if (!Object.values(MaterialRequestStatus).includes(status as MaterialRequestStatus)) {
    throw new Error("Status invalid");
  }

  const current = await prisma.materialRequest.findUnique({ where: { id }, select: { projectId: true } });
  if (!current) throw new Error("Cerere inexistenta.");
  await assertProjectAccess(currentUser, current.projectId);

  const request = await prisma.materialRequest.update({
    where: { id },
    data: {
      status: status as MaterialRequestStatus,
      approvedAt: new Date(),
      approvedById: currentUser.id,
    },
    include: { requestedBy: true },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "MATERIAL_REQUEST",
    entityId: id,
    action: "MATERIAL_REQUEST_STATUS_UPDATED",
    diff: { status },
  });

  await notifyUser({
    userId: request.requestedById,
    type: NotificationType.MATERIAL_REQUEST_APPROVAL_REQUIRED,
    title: "Cerere materiale actualizata",
    message: `Status nou: ${status}`,
    actionUrl: "/materiale",
  });

  revalidatePath("/materiale");
  revalidatePath("/panou");
}

export async function approveAndIssueMaterialRequest(formData: FormData) {
  const currentUser = await requirePermission("MATERIALS", "APPROVE");
  ensureStockAndInvoiceAccess(currentUser.roleKeys || []);
  const parsed = approveAndIssueSchema.safeParse({
    id: formData.get("id"),
    warehouseId: formData.get("warehouseId"),
  });
  if (!parsed.success) throw new Error("Date invalide pentru aprobare cu emitere din stoc.");

  const request = await prisma.materialRequest.findUnique({
    where: { id: parsed.data.id },
    include: {
      material: { select: { name: true, internalCost: true } },
      requestedBy: { select: { id: true } },
      project: { select: { title: true } },
    },
  });
  if (!request) throw new Error("Cerere inexistenta.");
  await assertProjectAccess(currentUser, request.projectId);

  if (request.status !== MaterialRequestStatus.PENDING) {
    throw new Error("Doar cererile PENDING pot fi aprobate cu emitere stoc.");
  }

  const existingIssuance = await prisma.stockMovement.findFirst({
    where: {
      materialId: request.materialId,
      warehouseId: parsed.data.warehouseId,
      type: StockMovementType.OUT,
      documentRef: `MATERIAL_REQUEST:${request.id}`,
    },
    select: { id: true },
  });
  if (existingIssuance) {
    throw new Error("Cererea are deja o emitere de stoc inregistrata.");
  }

  const warehouseMovements = await prisma.stockMovement.findMany({
    where: { materialId: request.materialId, warehouseId: parsed.data.warehouseId },
    select: { type: true, quantity: true },
  });
  const availableStock = warehouseMovements.reduce((sum, move) => {
    if (move.type === StockMovementType.OUT || move.type === StockMovementType.WASTE) return sum - Number(move.quantity);
    return sum + Number(move.quantity);
  }, 0);
  const requestedQty = Number(request.quantity);
  if (availableStock < requestedQty) {
    throw new Error(`Stoc insuficient in depozit (disponibil ${availableStock.toFixed(2)}, necesar ${requestedQty.toFixed(2)}).`);
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.materialRequest.update({
      where: { id: request.id },
      data: { status: MaterialRequestStatus.APPROVED, approvedAt: now, approvedById: currentUser.id },
    });

    const movement = await tx.stockMovement.create({
      data: {
        materialId: request.materialId,
        warehouseId: parsed.data.warehouseId,
        projectId: request.projectId,
        type: StockMovementType.OUT,
        quantity: request.quantity,
        note: `Emitere automata din cererea ${request.id}`,
        documentRef: `MATERIAL_REQUEST:${request.id}`,
      },
    });

    await tx.projectMaterialUsage.create({
      data: {
        projectId: request.projectId,
        materialId: request.materialId,
        quantityUsed: requestedQty,
        quantityIssued: requestedQty,
        note: `Consum din cerere materiale #${request.id}`,
      },
    });

    await tx.costEntry.create({
      data: {
        projectId: request.projectId,
        type: "MATERIAL",
        description: `Consum material ${request.material.name} din cererea #${request.id}`,
        amount: requestedQty * Number(request.material.internalCost || 0),
        occurredAt: now,
        approvedById: currentUser.id,
      },
    });

    await tx.activityLog.create({
      data: {
        userId: currentUser.id,
        entityType: "MATERIAL_REQUEST",
        entityId: request.id,
        action: "MATERIAL_REQUEST_APPROVED_AND_ISSUED",
        diff: {
          warehouseId: parsed.data.warehouseId,
          stockMovementId: movement.id,
          quantity: request.quantity.toString(),
          projectId: request.projectId,
        },
      },
    });
  });

  await notifyUser({
    userId: request.requestedBy.id,
    type: NotificationType.MATERIAL_REQUEST_APPROVAL_REQUIRED,
    title: "Cerere aprobata si emisa din stoc",
    message: `${request.project.title}: ${request.material.name} (${request.quantity.toString()})`,
    actionUrl: "/materiale",
  });

  revalidatePath("/materiale");
  revalidatePath("/financiar");
  revalidatePath("/proiecte");
  revalidatePath("/panou");
}

async function createStockMovementInternal(formData: FormData) {
  const currentUser = await requirePermission("MATERIALS", "UPDATE");
  ensureStockAndInvoiceAccess(currentUser.roleKeys || []);

  const parsed = movementSchema.safeParse({
    materialId: formData.get("materialId"),
    warehouseId: formData.get("warehouseId"),
    projectId: formData.get("projectId") || undefined,
    quantity: formData.get("quantity"),
    type: formData.get("type"),
    note: formData.get("note") || undefined,
  });

  if (!parsed.success) throw parsed.error;
  if (parsed.data.projectId) {
    await assertProjectAccess(currentUser, parsed.data.projectId);
  }

  const movement = await prisma.stockMovement.create({
    data: {
      materialId: parsed.data.materialId,
      warehouseId: parsed.data.warehouseId,
      projectId: parsed.data.projectId,
      quantity: parsed.data.quantity,
      type: parsed.data.type,
      note: parsed.data.note,
    },
  });

  if (movement.projectId && (movement.type === StockMovementType.OUT || movement.type === StockMovementType.WASTE)) {
    const material = await prisma.material.findUnique({
      where: { id: movement.materialId },
      select: { internalCost: true, name: true },
    });
    const unitCost = Number(material?.internalCost || 0);
    const quantity = Number(movement.quantity);
    const amount = unitCost * quantity;

    await prisma.projectMaterialUsage.create({
      data: {
        projectId: movement.projectId,
        materialId: movement.materialId,
        quantityUsed: quantity,
        quantityIssued: movement.type === StockMovementType.OUT ? quantity : 0,
        note: `Miscare stoc #${movement.id}`,
      },
    });

    await prisma.costEntry.create({
      data: {
        projectId: movement.projectId,
        type: "MATERIAL",
        description: `Consum material ${material?.name || movement.materialId} (#${movement.id})`,
        amount,
        occurredAt: movement.movedAt,
        approvedById: currentUser.id,
      },
    });
  }

  await logActivity({
    userId: currentUser.id,
    entityType: "STOCK_MOVEMENT",
    entityId: movement.id,
    action: "STOCK_MOVEMENT_CREATED",
    diff: { type: movement.type, quantity: movement.quantity.toString(), projectId: movement.projectId ?? null },
  });

  revalidatePath("/materiale");
  revalidatePath("/panou");
}

export async function createStockMovementAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await createStockMovementInternal(formData);
    return { ok: true, message: "Miscarea de stoc a fost inregistrata." };
  } catch (error) {
    if (error instanceof z.ZodError) return fromZodError(error);
    return { ok: false, message: error instanceof Error ? error.message : "Eroare la inregistrarea miscarii" };
  }
}

export async function createMaterialAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    await requirePermission("MATERIALS", "CREATE");

    const parsed = createMaterialSchema.safeParse({
      code: formData.get("code"),
      name: formData.get("name"),
      unitOfMeasure: formData.get("unitOfMeasure"),
      category: formData.get("category") || undefined,
      internalCost: formData.get("internalCost") || undefined,
      minStockLevel: formData.get("minStockLevel") || undefined,
      supplierName: formData.get("supplierName") || undefined,
    });

    if (!parsed.success) return fromZodError(parsed.error);

    await prisma.material.create({
      data: {
        code: parsed.data.code,
        name: parsed.data.name,
        unitOfMeasure: parsed.data.unitOfMeasure,
        category: parsed.data.category,
        internalCost: parsed.data.internalCost,
        minStockLevel: parsed.data.minStockLevel,
        supplierName: parsed.data.supplierName,
      },
    });

    revalidatePath("/materiale");
    return { ok: true, message: "Material adaugat in catalog." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Eroare la creare material" };
  }
}

export async function uploadMaterialInvoiceAction(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const currentUser = await requirePermission("MATERIALS", "CREATE");
    ensureStockAndInvoiceAccess(currentUser.roleKeys || []);
    const projectId = (formData.get("projectId") || "").toString();
    const invoiceNumber = (formData.get("invoiceNumber") || "").toString().trim();
    const note = (formData.get("note") || "").toString().trim();
    const file = formData.get("file");

    if (!projectId) return { ok: false, message: "Proiectul este obligatoriu." };
    if (!invoiceNumber) return { ok: false, message: "Numarul facturii este obligatoriu." };
    if (!(file instanceof File)) return { ok: false, message: "Fisier lipsa." };
    await assertProjectAccess(currentUser, projectId);

    const uploaded = await uploadDocumentFile(file);
    await prisma.document.create({
      data: {
        category: "INVOICE",
        title: `Factura materiale ${invoiceNumber}`,
        fileName: uploaded.fileName,
        storagePath: uploaded.storagePath,
        mimeType: uploaded.mimeType,
        projectId,
        uploadedById: currentUser.id,
        tags: ["material-invoice", invoiceNumber, note].filter(Boolean),
      },
    });

    revalidatePath("/materiale");
    revalidatePath("/documente");
    return { ok: true, message: "Factura materiale incarcata." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Eroare la upload factura." };
  }
}

const bulkMaterialRequestSchema = z.object({
  operation: z.enum(["APPROVE", "REJECT"]),
  ids: z.array(z.string().cuid()).min(1),
});

export async function bulkMaterialRequestsAction(formData: FormData) {
  const currentUser = await requirePermission("MATERIALS", "APPROVE");
  const operation = String(formData.get("operation") || "");
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const parsed = bulkMaterialRequestSchema.safeParse({ operation, ids });
  if (!parsed.success) throw new Error("Selectie bulk invalida pentru cereri materiale.");

  const scope = await resolveAccessScope(currentUser);
  let scopedIds = parsed.data.ids;
  if (scope.projectIds !== null) {
    const allowed = await prisma.materialRequest.findMany({
      where: { id: { in: parsed.data.ids }, projectId: { in: scope.projectIds } },
      select: { id: true },
    });
    const allowedSet = new Set(allowed.map((row) => row.id));
    scopedIds = parsed.data.ids.filter((id) => allowedSet.has(id));
  }
  if (scopedIds.length === 0) throw new Error("Nu ai acces la cererile selectate.");

  const status = parsed.data.operation === "APPROVE" ? MaterialRequestStatus.APPROVED : MaterialRequestStatus.REJECTED;
  const result = await prisma.materialRequest.updateMany({
    where: { id: { in: scopedIds }, status: MaterialRequestStatus.PENDING },
    data: { status, approvedAt: new Date(), approvedById: currentUser.id },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "MATERIAL_REQUEST_BULK",
    entityId: "MULTI",
    action: `MATERIAL_REQUESTS_${status}_BULK`,
    diff: { ids: scopedIds, affectedRows: result.count },
  });

  revalidatePath("/materiale");
  revalidatePath("/panou");
}
