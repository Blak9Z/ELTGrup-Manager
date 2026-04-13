"use server";

import { RoleKey } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionState } from "@/src/lib/action-state";
import { logActivity } from "@/src/lib/activity-log";
import { requirePermission } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";
import { hasSuperAdminRole } from "@/src/lib/rbac";

function hasSuperAdminRoleKey(roleKeys: RoleKey[]) {
  return roleKeys.includes(RoleKey.SUPER_ADMIN);
}

async function countActiveSuperAdmins(tx: typeof prisma = prisma) {
  return tx.userRole.count({
    where: {
      role: { key: RoleKey.SUPER_ADMIN },
      user: { deletedAt: null, isActive: true },
    },
  });
}

const createUserSchema = z.object({
  firstName: z.string().trim().min(2),
  lastName: z.string().trim().min(2),
  email: z.email(),
  password: z.string().min(6),
  roleKey: z.nativeEnum(RoleKey),
  positionTitle: z.string().trim().optional(),
  confirmSuperAdminAssignment: z.string().optional(),
});

export async function createUserAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("USERS", "CREATE");

    const parsed = createUserSchema.safeParse({
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: String(formData.get("email") || "").toLowerCase(),
      password: formData.get("password"),
      roleKey: formData.get("roleKey"),
      positionTitle: formData.get("positionTitle") || undefined,
      confirmSuperAdminAssignment: formData.get("confirmSuperAdminAssignment") || undefined,
    });

    if (!parsed.success) {
      return { ok: false, message: "Date utilizator invalide.", errors: parsed.error.flatten().fieldErrors };
    }

    if (parsed.data.roleKey === RoleKey.SUPER_ADMIN) {
      if (!hasSuperAdminRole(actor.roleKeys || [])) {
        return { ok: false, message: "Doar un utilizator cu rol SUPER_ADMIN poate atribui acest rol." };
      }
      if (parsed.data.confirmSuperAdminAssignment !== "CONFIRM_SUPER_ADMIN") {
        return { ok: false, message: "Confirma explicit atribuirea rolului SUPER_ADMIN." };
      }
    }

    const role = await prisma.role.findUnique({ where: { key: parsed.data.roleKey } });
    if (!role) throw new Error("Rol inexistent. Actualizeaza pagina si incearca din nou.");

    const passwordHash = await bcrypt.hash(parsed.data.password, 10);
    const existingUser = await prisma.user.findUnique({
      where: { email: parsed.data.email },
      include: { workerProfile: true },
    });

    if (existingUser && !existingUser.deletedAt) {
      return { ok: false, message: "Exista deja un cont activ cu acest email." };
    }

    if (existingUser?.deletedAt) {
      await prisma.$transaction(async (tx) => {
        await tx.user.update({
          where: { id: existingUser.id },
          data: {
            firstName: parsed.data.firstName,
            lastName: parsed.data.lastName,
            email: parsed.data.email,
            passwordHash,
            isActive: true,
            deletedAt: null,
          },
        });

        await tx.userRole.deleteMany({ where: { userId: existingUser.id } });
        await tx.userRole.create({
          data: { userId: existingUser.id, roleId: role.id },
        });

        if (parsed.data.positionTitle) {
          await tx.workerProfile.upsert({
            where: { userId: existingUser.id },
            update: {
              positionTitle: parsed.data.positionTitle,
              deletedAt: null,
            },
            create: {
              userId: existingUser.id,
              employeeCode: `EMP-${Date.now().toString().slice(-6)}`,
              positionTitle: parsed.data.positionTitle,
            },
          });
        }

        await tx.activityLog.create({
          data: {
            userId: actor.id,
            entityType: "USER",
            entityId: existingUser.id,
            action: "ROLE_ASSIGNED_ON_REACTIVATE",
            diff: {
              roleKey: parsed.data.roleKey,
              targetEmail: parsed.data.email,
            },
          },
        });
      });

      revalidatePath("/setari");
      return { ok: true, message: "Utilizator reactivat cu succes." };
    }

    const createdUser = await prisma.user.create({
      data: {
        firstName: parsed.data.firstName,
        lastName: parsed.data.lastName,
        email: parsed.data.email,
        passwordHash,
        roles: { create: [{ roleId: role.id }] },
        workerProfile: parsed.data.positionTitle
          ? {
              create: {
                employeeCode: `EMP-${Date.now().toString().slice(-6)}`,
                positionTitle: parsed.data.positionTitle,
              },
            }
          : undefined,
      },
    });

    await logActivity({
      userId: actor.id,
      entityType: "USER",
      entityId: createdUser.id,
      action: "ROLE_ASSIGNED_ON_CREATE",
      diff: {
        roleKey: parsed.data.roleKey,
        targetEmail: parsed.data.email,
      },
    });

    revalidatePath("/setari");
    return { ok: true, message: "Utilizator creat." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Eroare la creare utilizator." };
  }
}

const deleteUserSchema = z.object({
  userId: z.string().cuid(),
});

function buildDeletedEmail(email: string, userId: string) {
  const [local, domain = "deleted.local"] = email.toLowerCase().split("@");
  return `${local}+deleted-${Date.now()}-${userId.slice(-6)}@${domain}`;
}

const updateRoleSchema = z.object({
  userId: z.string().cuid(),
  roleKey: z.nativeEnum(RoleKey),
  confirmSuperAdminAssignment: z.string().optional(),
});

export async function updateUserRolesAction(formData: FormData) {
  const actor = await requirePermission("USERS", "UPDATE");

  const explicitRoleKey = formData.get("roleKey");
  const legacyRoleKeys = formData.getAll("roleKeys").map(String).filter(Boolean);
  if (!explicitRoleKey && legacyRoleKeys.length === 0) {
    throw new Error("Nu ai selectat niciun rol.");
  }
  if (!explicitRoleKey && legacyRoleKeys.length > 1) {
    throw new Error("Selecteaza un singur rol.");
  }
  const submittedRoleKey = String(explicitRoleKey || legacyRoleKeys[0]);

  const parsed = updateRoleSchema.safeParse({
    userId: formData.get("userId"),
    roleKey: submittedRoleKey,
    confirmSuperAdminAssignment: formData.get("confirmSuperAdminAssignment") || undefined,
  });

  if (!parsed.success) throw new Error("Date rol invalide.");

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: {
      id: true,
      email: true,
      roles: { include: { role: { select: { key: true } } } },
    },
  });
  if (!target) throw new Error("Utilizator inexistent.");

  const targetHasSuperAdmin = target.roles.some((item) => item.role.key === RoleKey.SUPER_ADMIN);
  const actorHasSuperAdmin = hasSuperAdminRole(actor.roleKeys || []);

  if (targetHasSuperAdmin && parsed.data.roleKey !== RoleKey.SUPER_ADMIN) {
    const activeSuperAdminCount = await countActiveSuperAdmins();
    if (activeSuperAdminCount <= 1) {
      throw new Error("Nu poti elimina ultimul SUPER_ADMIN activ.");
    }
  }

  if (parsed.data.roleKey === RoleKey.SUPER_ADMIN) {
    if (!actorHasSuperAdmin) {
      throw new Error("Doar un utilizator cu rol SUPER_ADMIN poate atribui acest rol.");
    }
    if (parsed.data.confirmSuperAdminAssignment !== "CONFIRM_SUPER_ADMIN") {
      throw new Error("Confirma explicit atribuirea rolului SUPER_ADMIN.");
    }
  }

  const role = await prisma.role.findUnique({ where: { key: parsed.data.roleKey }, select: { id: true, key: true } });
  if (!role) throw new Error("Rol inexistent. Actualizeaza pagina si incearca din nou.");

  const previousRoles = target.roles.map((item) => item.role.key);

  await prisma.$transaction(async (tx) => {
    await tx.userRole.deleteMany({ where: { userId: target.id } });
    await tx.userRole.create({
      data: { userId: target.id, roleId: role.id },
    });

    await tx.activityLog.create({
      data: {
        userId: actor.id,
        entityType: "USER",
        entityId: target.id,
        action: "ROLE_UPDATED",
        diff: {
          previousRoleKeys: previousRoles,
          nextRoleKey: role.key,
          targetEmail: target.email,
        },
      },
    });
  });

  revalidatePath("/setari");
}

export async function toggleUserActiveAction(formData: FormData) {
  const actor = await requirePermission("USERS", "UPDATE");

  const userId = String(formData.get("userId") || "");
  const target = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, isActive: true, roles: { include: { role: { select: { key: true } } } } },
  });
  if (!target) throw new Error("Utilizator inexistent.");

  const targetHasSuperAdmin = target.roles.some((item) => item.role.key === RoleKey.SUPER_ADMIN);
  if (targetHasSuperAdmin && target.isActive) {
    const activeSuperAdminCount = await countActiveSuperAdmins();
    if (activeSuperAdminCount <= 1) {
      throw new Error("Nu poti dezactiva ultimul SUPER_ADMIN activ.");
    }
  }
  if (actor.id === target.id && hasSuperAdminRoleKey(actor.roleKeys || []) && target.isActive) {
    const activeSuperAdminCount = await countActiveSuperAdmins();
    if (activeSuperAdminCount <= 1) {
      throw new Error("Nu iti poti dezactiva propriul cont cand esti ultimul SUPER_ADMIN.");
    }
  }

  await prisma.user.update({ where: { id: target.id }, data: { isActive: !target.isActive } });
  revalidatePath("/setari");
}

export async function deleteUserAction(formData: FormData) {
  const actor = await requirePermission("USERS", "DELETE");
  const parsed = deleteUserSchema.safeParse({ userId: formData.get("userId") });
  if (!parsed.success) throw new Error("Date utilizator invalide.");

  const target = await prisma.user.findUnique({
    where: { id: parsed.data.userId },
    select: { id: true, email: true, roles: { include: { role: { select: { key: true } } } } },
  });
  if (!target) throw new Error("Utilizator inexistent.");
  if (actor.id === target.id) {
    throw new Error("Nu iti poti sterge propriul cont.");
  }
  const targetHasSuperAdmin = target.roles.some((item) => item.role.key === RoleKey.SUPER_ADMIN);
  if (targetHasSuperAdmin) {
    const activeSuperAdminCount = await countActiveSuperAdmins();
    if (activeSuperAdminCount <= 1) {
      throw new Error("Nu poti sterge ultimul SUPER_ADMIN activ.");
    }
  }

  const deletedAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.session.deleteMany({ where: { userId: target.id } });
    await tx.account.deleteMany({ where: { userId: target.id } });
    await tx.userRole.deleteMany({ where: { userId: target.id } });
    await tx.workerProfile.updateMany({
      where: { userId: target.id, deletedAt: null },
      data: { deletedAt },
    });
    await tx.user.update({
      where: { id: target.id },
      data: {
        isActive: false,
        deletedAt,
        email: buildDeletedEmail(target.email, target.id),
      },
    });
  });

  revalidatePath("/setari");
}
