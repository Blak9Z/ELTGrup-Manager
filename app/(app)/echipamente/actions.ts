"use server";

import { EquipmentStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/src/lib/activity-log";
import { ActionState, fromZodError } from "@/src/lib/action-state";
import { requirePermission } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";

const createEquipmentSchema = z.object({
  code: z.string().min(2),
  name: z.string().min(2),
  serialNumber: z.string().optional(),
  category: z.string().optional(),
  maintenanceDueAt: z.string().optional(),
});

async function createEquipmentInternal(formData: FormData) {
  const currentUser = await requirePermission("MATERIALS", "CREATE");

  const parsed = createEquipmentSchema.safeParse({
    code: formData.get("code"),
    name: formData.get("name"),
    serialNumber: formData.get("serialNumber") || undefined,
    category: formData.get("category") || undefined,
    maintenanceDueAt: formData.get("maintenanceDueAt") || undefined,
  });

  if (!parsed.success) throw parsed.error;

  const equipment = await prisma.equipment.create({
    data: {
      code: parsed.data.code,
      name: parsed.data.name,
      serialNumber: parsed.data.serialNumber,
      category: parsed.data.category,
      maintenanceDueAt: parsed.data.maintenanceDueAt ? new Date(parsed.data.maintenanceDueAt) : null,
    },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "EQUIPMENT",
    entityId: equipment.id,
    action: "EQUIPMENT_CREATED",
  });

  revalidatePath("/echipamente");
}

export async function createEquipmentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await createEquipmentInternal(formData);
    return { ok: true, message: "Echipament adaugat cu succes." };
  } catch (error) {
    if (error instanceof z.ZodError) return fromZodError(error);
    return { ok: false, message: error instanceof Error ? error.message : "Eroare la creare echipament" };
  }
}

export async function updateEquipmentStatus(formData: FormData) {
  const currentUser = await requirePermission("MATERIALS", "UPDATE");
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));

  if (!Object.values(EquipmentStatus).includes(status as EquipmentStatus)) {
    throw new Error("Status invalid");
  }

  await prisma.equipment.update({
    where: { id },
    data: { status: status as EquipmentStatus },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "EQUIPMENT",
    entityId: id,
    action: "EQUIPMENT_STATUS_UPDATED",
    diff: { status },
  });

  revalidatePath("/echipamente");
}
