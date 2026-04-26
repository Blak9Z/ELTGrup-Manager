"use server";

import { PermitApplicationStatus } from "@prisma/client";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { requirePermission } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";
import { logActivity } from "@/src/lib/activity-log";

const permitSchema = z.object({
  projectId: z.string().min(1),
  type: z.enum(["AVIZ_ISU", "AVIZ_SSM", "AVIZ_POMPIERI", "RECEPTIE_PSI"]),
  submittedAt: z.string().optional(),
  notes: z.string().optional(),
});

const statusUpdateSchema = z.object({
  id: z.string().min(1),
  status: z.nativeEnum(PermitApplicationStatus),
  responseDate: z.string().optional(),
  rejectionReason: z.string().optional(),
  projectId: z.string().min(1),
});

export async function createPermitApplication(formData: FormData) {
  const user = await requirePermission("PROJECTS", "UPDATE");
  const raw = Object.fromEntries(formData.entries());
  const parsed = permitSchema.safeParse(raw);
  if (!parsed.success) return;
  const data = parsed.data;

  const permit = await prisma.permitApplication.create({
    data: {
      projectId: data.projectId,
      type: data.type,
      submittedAt: data.submittedAt ? new Date(data.submittedAt) : new Date(),
      notes: data.notes || null,
    },
  });

  await logActivity({
    userId: user.id,
    entityType: "PERMIT",
    entityId: permit.id,
    action: "PERMIT_CREATED",
    diff: { type: data.type, status: "SUBMITTED" },
  });

  revalidatePath(`/proiecte/${data.projectId}`);
}

export async function updatePermitStatus(formData: FormData) {
  const user = await requirePermission("PROJECTS", "UPDATE");
  const raw = Object.fromEntries(formData.entries());
  const parsed = statusUpdateSchema.safeParse(raw);
  if (!parsed.success) return;
  const data = parsed.data;

  const updateData: {
    status: PermitApplicationStatus;
    responseDate?: Date;
    rejectionReason?: string;
  } = { status: data.status };

  if (data.responseDate) updateData.responseDate = new Date(data.responseDate);
  if (data.rejectionReason) updateData.rejectionReason = data.rejectionReason;

  await prisma.permitApplication.update({
    where: { id: data.id },
    data: updateData,
  });

  await logActivity({
    userId: user.id,
    entityType: "PERMIT",
    entityId: data.id,
    action: "PERMIT_STATUS_UPDATED",
    diff: { status: data.status },
  });

  revalidatePath(`/proiecte/${data.projectId}`);
}
