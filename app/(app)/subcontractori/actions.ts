"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/src/lib/activity-log";
import { ActionState, fromZodError } from "@/src/lib/action-state";
import { assertSubcontractorAccess } from "@/src/lib/access-scope";
import { requirePermission } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";
import { SUBCONTRACTOR_APPROVAL_STATUSES } from "./constants";

const subcontractorStatusSchema = z.enum(SUBCONTRACTOR_APPROVAL_STATUSES);

const subcontractorSchema = z.object({
  name: z.string().min(2),
  cui: z.string().optional(),
  contactName: z.string().optional(),
  email: z.email().optional().or(z.literal("")),
  phone: z.string().optional(),
  approvalStatus: subcontractorStatusSchema,
});

async function createSubcontractorInternal(formData: FormData) {
  const currentUser = await requirePermission("TASKS", "CREATE");

  const parsed = subcontractorSchema.safeParse({
    name: formData.get("name"),
    cui: formData.get("cui") || undefined,
    contactName: formData.get("contactName") || undefined,
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    approvalStatus: formData.get("approvalStatus") || "IN_VERIFICARE",
  });

  if (!parsed.success) throw parsed.error;

  const created = await prisma.subcontractor.create({
    data: {
      name: parsed.data.name,
      cui: parsed.data.cui,
      contactName: parsed.data.contactName,
      email: parsed.data.email || null,
      phone: parsed.data.phone,
      approvalStatus: parsed.data.approvalStatus,
    },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "SUBCONTRACTOR",
    entityId: created.id,
    action: "SUBCONTRACTOR_CREATED",
  });

  revalidatePath("/subcontractori");
}

export async function createSubcontractorAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await createSubcontractorInternal(formData);
    return { ok: true, message: "Subcontractor creat cu succes." };
  } catch (error) {
    if (error instanceof z.ZodError) return fromZodError(error);
    return { ok: false, message: error instanceof Error ? error.message : "Eroare la creare subcontractor" };
  }
}

export async function updateSubcontractorStatus(formData: FormData) {
  const currentUser = await requirePermission("TASKS", "UPDATE");
  const parsed = z
    .object({
      id: z.string().cuid(),
      approvalStatus: subcontractorStatusSchema,
    })
    .safeParse({
      id: formData.get("id"),
      approvalStatus: formData.get("approvalStatus"),
    });
  if (!parsed.success) throw new Error("Status subcontractor invalid.");
  const { id, approvalStatus } = parsed.data;
  await assertSubcontractorAccess(currentUser, id);

  await prisma.subcontractor.update({
    where: { id },
    data: { approvalStatus },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "SUBCONTRACTOR",
    entityId: id,
    action: "SUBCONTRACTOR_STATUS_UPDATED",
    diff: { status: approvalStatus },
  });

  revalidatePath("/subcontractori");
}

const updateSubcontractorSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(2),
  cui: z.string().optional(),
  contactName: z.string().optional(),
  email: z.email().optional().or(z.literal("")),
  phone: z.string().optional(),
  approvalStatus: subcontractorStatusSchema,
});

export async function updateSubcontractorAction(formData: FormData) {
  const currentUser = await requirePermission("TASKS", "UPDATE");

  const parsed = updateSubcontractorSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    cui: formData.get("cui") || undefined,
    contactName: formData.get("contactName") || undefined,
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    approvalStatus: formData.get("approvalStatus") || "IN_VERIFICARE",
  });
  if (!parsed.success) throw parsed.error;
  await assertSubcontractorAccess(currentUser, parsed.data.id);

  await prisma.subcontractor.update({
    where: { id: parsed.data.id },
    data: {
      name: parsed.data.name,
      cui: parsed.data.cui,
      contactName: parsed.data.contactName,
      email: parsed.data.email || null,
      phone: parsed.data.phone,
      approvalStatus: parsed.data.approvalStatus,
    },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "SUBCONTRACTOR",
    entityId: parsed.data.id,
    action: "SUBCONTRACTOR_UPDATED",
  });

  revalidatePath("/subcontractori");
}
