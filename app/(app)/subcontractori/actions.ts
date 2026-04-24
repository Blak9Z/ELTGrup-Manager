"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/src/lib/activity-log";
import { ActionState, fromZodError } from "@/src/lib/action-state";
import { assertSubcontractorAccess, resolveAccessScope, subcontractorScopeWhere } from "@/src/lib/access-scope";
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

const archiveSubcontractorSchema = z.object({
  id: z.string().cuid(),
});

const bulkArchiveSubcontractorsSchema = z.object({
  ids: z.array(z.string().cuid()).min(1),
});

function revalidateSubcontractorRelatedPaths(subcontractorId?: string) {
  revalidatePath("/subcontractori");
  revalidatePath("/proiecte");
  revalidatePath("/lucrari");
  if (subcontractorId) revalidatePath(`/subcontractori/${subcontractorId}`);
}

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

  revalidateSubcontractorRelatedPaths(created.id);
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

  revalidateSubcontractorRelatedPaths(id);
}

const updateSubcontractorSchema = z.object({
  id: z.string().cuid(),
  name: z.string().min(2),
  cui: z.string().optional(),
  contactName: z.string().optional(),
  email: z.email().optional().or(z.literal("")),
  phone: z.string().optional(),
  approvalStatus: subcontractorStatusSchema.optional(),
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
    approvalStatus: formData.get("approvalStatus") || undefined,
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
      ...(parsed.data.approvalStatus ? { approvalStatus: parsed.data.approvalStatus } : {}),
    },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "SUBCONTRACTOR",
    entityId: parsed.data.id,
    action: "SUBCONTRACTOR_UPDATED",
  });

  revalidateSubcontractorRelatedPaths(parsed.data.id);
}

export async function archiveSubcontractor(formData: FormData) {
  const currentUser = await requirePermission("TASKS", "DELETE");
  const parsed = archiveSubcontractorSchema.safeParse({
    id: formData.get("id"),
  });
  if (!parsed.success) throw new Error("Subcontractor invalid pentru arhivare.");

  await assertSubcontractorAccess(currentUser, parsed.data.id);

  const existingSubcontractor = await prisma.subcontractor.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, name: true, deletedAt: true },
  });
  if (!existingSubcontractor || existingSubcontractor.deletedAt) {
    throw new Error("Subcontractor inexistent sau deja arhivat.");
  }

  await prisma.subcontractor.update({
    where: { id: parsed.data.id },
    data: { deletedAt: new Date() },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "SUBCONTRACTOR",
    entityId: parsed.data.id,
    action: "SUBCONTRACTOR_SOFT_DELETED",
    diff: { name: existingSubcontractor.name },
  });

  revalidateSubcontractorRelatedPaths(parsed.data.id);
}

export async function bulkArchiveSubcontractorsAction(formData: FormData) {
  const currentUser = await requirePermission("TASKS", "DELETE");
  const parsed = bulkArchiveSubcontractorsSchema.safeParse({
    ids: formData.getAll("ids").map(String).filter(Boolean),
  });
  if (!parsed.success) throw new Error("Selectie invalida pentru arhivarea subcontractorilor.");

  const scope = await resolveAccessScope(currentUser);
  let scopedIds = parsed.data.ids;

  if (scope.projectIds !== null) {
    const allowedIds = new Set(
      (
        await prisma.subcontractor.findMany({
          where: {
            id: { in: parsed.data.ids },
            deletedAt: null,
            ...subcontractorScopeWhere(scope),
          },
          select: { id: true },
        })
      ).map((subcontractor) => subcontractor.id),
    );
    scopedIds = parsed.data.ids.filter((id) => allowedIds.has(id));
  }

  if (scopedIds.length === 0) {
    throw new Error("Nu ai acces la subcontractorii selectati.");
  }

  const result = await prisma.subcontractor.updateMany({
    where: { id: { in: scopedIds }, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "SUBCONTRACTOR_BULK",
    entityId: "MULTI",
    action: "SUBCONTRACTORS_ARCHIVED_BULK",
    diff: {
      ids: scopedIds,
      affectedRows: result.count,
    },
  });

  revalidateSubcontractorRelatedPaths();
}
