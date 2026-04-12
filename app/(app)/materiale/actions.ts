"use server";

import { MaterialRequestStatus, NotificationType, RoleKey, StockMovementType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/src/lib/activity-log";
import { ActionState, fromZodError } from "@/src/lib/action-state";
import { notifyRoles, notifyUser } from "@/src/lib/notifications";
import { requirePermission } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";

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

async function createMaterialRequestInternal(formData: FormData) {
  const currentUser = await requirePermission("MATERIALS", "CREATE");

  const parsed = requestSchema.safeParse({
    projectId: formData.get("projectId"),
    materialId: formData.get("materialId"),
    quantity: formData.get("quantity"),
    note: formData.get("note") || undefined,
  });

  if (!parsed.success) throw parsed.error;

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

async function createStockMovementInternal(formData: FormData) {
  const currentUser = await requirePermission("MATERIALS", "UPDATE");

  const parsed = movementSchema.safeParse({
    materialId: formData.get("materialId"),
    warehouseId: formData.get("warehouseId"),
    projectId: formData.get("projectId") || undefined,
    quantity: formData.get("quantity"),
    type: formData.get("type"),
    note: formData.get("note") || undefined,
  });

  if (!parsed.success) throw parsed.error;

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

  const status = parsed.data.operation === "APPROVE" ? MaterialRequestStatus.APPROVED : MaterialRequestStatus.REJECTED;
  const result = await prisma.materialRequest.updateMany({
    where: { id: { in: parsed.data.ids }, status: MaterialRequestStatus.PENDING },
    data: { status, approvedAt: new Date(), approvedById: currentUser.id },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "MATERIAL_REQUEST_BULK",
    entityId: "MULTI",
    action: `MATERIAL_REQUESTS_${status}_BULK`,
    diff: { ids: parsed.data.ids, affectedRows: result.count },
  });

  revalidatePath("/materiale");
  revalidatePath("/panou");
}
