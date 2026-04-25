"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionState, fromZodError } from "@/src/lib/action-state";
import { logActivity } from "@/src/lib/activity-log";
import { requirePermission } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";

const teamSchema = z.object({
  name: z.string().trim().min(2, "Numele echipei este obligatoriu."),
  code: z.string().trim().min(2, "Codul echipei este obligatoriu.").max(32),
  region: z.string().trim().optional(),
  leadUserId: z.string().cuid().optional(),
  isActive: z.coerce.boolean().default(true),
});

const updateTeamSchema = teamSchema.extend({
  id: z.string().cuid(),
});

const teamIdSchema = z.object({
  id: z.string().cuid(),
});

const updateTeamMembersSchema = z.object({
  id: z.string().cuid(),
  memberIds: z.array(z.string().cuid()),
});

function revalidateTeamPaths() {
  revalidatePath("/echipe");
  revalidatePath("/lucrari");
  revalidatePath("/calendar");
}

function normalizeCode(code: string) {
  return code.trim().toUpperCase().replace(/\s+/g, "-");
}

async function createTeamInternal(formData: FormData) {
  const currentUser = await requirePermission("TEAMS", "CREATE");
  const memberIds = formData.getAll("memberIds").map(String).filter(Boolean);
  const parsed = teamSchema.safeParse({
    name: formData.get("name"),
    code: formData.get("code"),
    region: formData.get("region") || undefined,
    leadUserId: formData.get("leadUserId") || undefined,
    isActive: formData.get("isActive") !== "false",
  });

  if (!parsed.success) throw parsed.error;

  const created = await prisma.team.create({
    data: {
      ...parsed.data,
      code: normalizeCode(parsed.data.code),
    },
    select: { id: true, name: true, code: true },
  });

  if (memberIds.length) {
    await prisma.workerProfile.updateMany({
      where: { id: { in: memberIds }, deletedAt: null },
      data: { teamId: created.id },
    });
  }

  await logActivity({
    userId: currentUser.id,
    entityType: "TEAM",
    entityId: created.id,
    action: "TEAM_CREATED",
    diff: { name: created.name, code: created.code, memberIds },
  });

  revalidateTeamPaths();
}

export async function createTeamAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await createTeamInternal(formData);
    return { ok: true, message: "Echipa creata cu succes." };
  } catch (error) {
    if (error instanceof z.ZodError) return fromZodError(error);
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Eroare la creare echipa.",
    };
  }
}

export async function updateTeamAction(formData: FormData) {
  const currentUser = await requirePermission("TEAMS", "UPDATE");
  const parsed = updateTeamSchema.safeParse({
    id: formData.get("id"),
    name: formData.get("name"),
    code: formData.get("code"),
    region: formData.get("region") || undefined,
    leadUserId: formData.get("leadUserId") || undefined,
    isActive: formData.get("isActive") === "true",
  });

  if (!parsed.success) throw new Error("Date invalide pentru echipa.");

  const updated = await prisma.team.update({
    where: { id: parsed.data.id },
    data: {
      name: parsed.data.name,
      code: normalizeCode(parsed.data.code),
      region: parsed.data.region,
      leadUserId: parsed.data.leadUserId,
      isActive: parsed.data.isActive,
    },
    select: { id: true, name: true, code: true, isActive: true },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "TEAM",
    entityId: updated.id,
    action: "TEAM_UPDATED",
    diff: { name: updated.name, code: updated.code, isActive: updated.isActive },
  });

  revalidateTeamPaths();
}

export async function updateTeamMembersAction(formData: FormData) {
  const currentUser = await requirePermission("TEAMS", "UPDATE");
  const parsed = updateTeamMembersSchema.safeParse({
    id: formData.get("id"),
    memberIds: formData.getAll("memberIds").map(String).filter(Boolean),
  });

  if (!parsed.success) throw new Error("Selectie invalida pentru membrii echipei.");

  const team = await prisma.team.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, name: true, deletedAt: true },
  });
  if (!team || team.deletedAt) throw new Error("Echipa inexistenta sau arhivata.");

  await prisma.$transaction([
    prisma.workerProfile.updateMany({
      where: { teamId: team.id, id: { notIn: parsed.data.memberIds } },
      data: { teamId: null },
    }),
    prisma.workerProfile.updateMany({
      where: { id: { in: parsed.data.memberIds }, deletedAt: null },
      data: { teamId: team.id },
    }),
  ]);

  await logActivity({
    userId: currentUser.id,
    entityType: "TEAM",
    entityId: team.id,
    action: "TEAM_MEMBERS_UPDATED",
    diff: { name: team.name, memberIds: parsed.data.memberIds },
  });

  revalidateTeamPaths();
}

export async function archiveTeamAction(formData: FormData) {
  const currentUser = await requirePermission("TEAMS", "DELETE");
  const parsed = teamIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) throw new Error("Echipa invalida pentru arhivare.");

  const existing = await prisma.team.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, name: true, deletedAt: true },
  });
  if (!existing || existing.deletedAt) throw new Error("Echipa inexistenta sau deja arhivata.");

  await prisma.team.update({
    where: { id: parsed.data.id },
    data: { deletedAt: new Date(), isActive: false },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "TEAM",
    entityId: existing.id,
    action: "TEAM_ARCHIVED",
    diff: { name: existing.name },
  });

  revalidateTeamPaths();
}

export async function restoreTeamAction(formData: FormData) {
  const currentUser = await requirePermission("TEAMS", "UPDATE");
  const parsed = teamIdSchema.safeParse({ id: formData.get("id") });
  if (!parsed.success) throw new Error("Echipa invalida pentru restaurare.");

  const restored = await prisma.team.update({
    where: { id: parsed.data.id },
    data: { deletedAt: null, isActive: true },
    select: { id: true, name: true },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "TEAM",
    entityId: restored.id,
    action: "TEAM_RESTORED",
    diff: { name: restored.name },
  });

  revalidateTeamPaths();
}
