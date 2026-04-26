"use server";

import { InstallationStatus, Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/src/lib/activity-log";
import { requirePermission } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";

const installationSchema = z.object({
  projectId: z.string().min(1),
  name: z.string().min(1),
  manufacturer: z.string().min(1),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  warrantyMonths: z.coerce.number().min(1).default(24),
  installedAt: z.string().optional(),
  certifiedAt: z.string().optional(),
  nextCheckAt: z.string().optional(),
  status: z.nativeEnum(InstallationStatus).optional(),
  notes: z.string().optional(),
});

export async function createInstallation(formData: FormData) {
  const user = await requirePermission("PROJECTS", "UPDATE");
  const raw = Object.fromEntries(formData.entries());
  const parsed = installationSchema.safeParse(raw);
  if (!parsed.success) return;

  const data = await prisma.projectInstallation.create({
    data: {
      projectId: parsed.data.projectId,
      name: parsed.data.name,
      manufacturer: parsed.data.manufacturer,
      model: parsed.data.model || null,
      serialNumber: parsed.data.serialNumber || null,
      warrantyMonths: parsed.data.warrantyMonths,
      installedAt: parsed.data.installedAt ? new Date(parsed.data.installedAt) : null,
      certifiedAt: parsed.data.certifiedAt ? new Date(parsed.data.certifiedAt) : null,
      nextCheckAt: parsed.data.nextCheckAt ? new Date(parsed.data.nextCheckAt) : null,
      status: parsed.data.status || InstallationStatus.INSTALLED,
      notes: parsed.data.notes || null,
    },
  });

  await logActivity({
    userId: user.id,
    entityType: "INSTALLATION",
    entityId: data.id,
    action: "INSTALLATION_CREATED",
    diff: { name: parsed.data.name, manufacturer: parsed.data.manufacturer },
  });

  revalidatePath(`/proiecte/${parsed.data.projectId}`);
}

export async function updateInstallationStatus(formData: FormData) {
  const user = await requirePermission("PROJECTS", "UPDATE");
  const id = formData.get("id");
  const projectId = formData.get("projectId");
  const status = formData.get("status");
  if (!id || !status || !projectId || typeof id !== "string" || typeof status !== "string" || typeof projectId !== "string") return;

  const validStatus = Object.values(InstallationStatus).includes(status as InstallationStatus) ? (status as InstallationStatus) : undefined;
  if (!validStatus) return;

  await prisma.projectInstallation.update({
    where: { id },
    data: { status: validStatus },
  });

  await logActivity({
    userId: user.id,
    entityType: "INSTALLATION",
    entityId: id,
    action: "INSTALLATION_STATUS_UPDATED",
    diff: { status: validStatus },
  });

  revalidatePath(`/proiecte/${projectId}`);
}

export async function archiveInstallation(formData: FormData) {
  const user = await requirePermission("PROJECTS", "UPDATE");
  const id = formData.get("id");
  const projectId = formData.get("projectId");
  if (!id || !projectId || typeof id !== "string" || typeof projectId !== "string") return;

  await prisma.projectInstallation.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await logActivity({
    userId: user.id,
    entityType: "INSTALLATION",
    entityId: id,
    action: "INSTALLATION_ARCHIVED",
  });

  revalidatePath(`/proiecte/${projectId}`);
}
