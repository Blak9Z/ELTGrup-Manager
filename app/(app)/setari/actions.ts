"use server";

import { RoleKey } from "@prisma/client";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ActionState } from "@/src/lib/action-state";
import { requirePermission } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";
import { SUPER_ADMIN_EMAIL, isAbsoluteSuperAdmin } from "@/src/lib/rbac";

const createUserSchema = z.object({
  firstName: z.string().trim().min(2),
  lastName: z.string().trim().min(2),
  email: z.email(),
  password: z.string().min(6),
  roleKey: z.nativeEnum(RoleKey),
  positionTitle: z.string().trim().optional(),
});

export async function createUserAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await requirePermission("USERS", "CREATE");

    const parsed = createUserSchema.safeParse({
      firstName: formData.get("firstName"),
      lastName: formData.get("lastName"),
      email: String(formData.get("email") || "").toLowerCase(),
      password: formData.get("password"),
      roleKey: formData.get("roleKey"),
      positionTitle: formData.get("positionTitle") || undefined,
    });

    if (!parsed.success) {
      return { ok: false, message: "Date utilizator invalide.", errors: parsed.error.flatten().fieldErrors };
    }

    if (parsed.data.roleKey === RoleKey.SUPER_ADMIN && !isAbsoluteSuperAdmin(parsed.data.email)) {
      return { ok: false, message: `Rolul SUPER_ADMIN este rezervat pentru ${SUPER_ADMIN_EMAIL}.` };
    }

    const role = await prisma.role.findUnique({ where: { key: parsed.data.roleKey } });
    if (!role) throw new Error("Rol inexistent.");

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
      });

      revalidatePath("/setari");
      return { ok: true, message: "Utilizator reactivat cu succes." };
    }

    await prisma.user.create({
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

const updateRolesSchema = z.object({
  userId: z.string().cuid(),
  roleKeys: z.array(z.nativeEnum(RoleKey)).min(1),
});

export async function updateUserRolesAction(formData: FormData) {
  const actor = await requirePermission("USERS", "UPDATE");

  const parsed = updateRolesSchema.safeParse({
    userId: formData.get("userId"),
    roleKeys: formData.getAll("roleKeys").map(String),
  });

  if (!parsed.success) throw new Error("Date roluri invalide.");

  const target = await prisma.user.findUnique({ where: { id: parsed.data.userId }, select: { id: true, email: true } });
  if (!target) throw new Error("Utilizator inexistent.");

  if (isAbsoluteSuperAdmin(target.email)) {
    await ensureSuperAdminRole(target.id);
    revalidatePath("/setari");
    return;
  }

  if (parsed.data.roleKeys.includes(RoleKey.SUPER_ADMIN)) {
    throw new Error(`Rolul SUPER_ADMIN este rezervat pentru ${SUPER_ADMIN_EMAIL}.`);
  }

  const roles = await prisma.role.findMany({ where: { key: { in: parsed.data.roleKeys } }, select: { id: true } });

  await prisma.$transaction([
    prisma.userRole.deleteMany({ where: { userId: target.id } }),
    prisma.userRole.createMany({
      data: roles.map((role) => ({ userId: target.id, roleId: role.id })),
      skipDuplicates: true,
    }),
  ]);

  if (isAbsoluteSuperAdmin(actor.email)) {
    await ensureSuperAdminRole(target.id);
  }

  revalidatePath("/setari");
}

export async function toggleUserActiveAction(formData: FormData) {
  await requirePermission("USERS", "UPDATE");

  const userId = String(formData.get("userId") || "");
  const target = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, isActive: true, email: true } });
  if (!target) throw new Error("Utilizator inexistent.");

  if (isAbsoluteSuperAdmin(target.email)) {
    throw new Error(`${SUPER_ADMIN_EMAIL} nu poate fi dezactivat.`);
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
    select: { id: true, email: true },
  });
  if (!target) throw new Error("Utilizator inexistent.");
  if (isAbsoluteSuperAdmin(target.email)) {
    throw new Error(`${SUPER_ADMIN_EMAIL} nu poate fi sters.`);
  }
  if (actor.id === target.id) {
    throw new Error("Nu iti poti sterge propriul cont.");
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

async function ensureSuperAdminRole(userId: string) {
  const role = await prisma.role.findUnique({ where: { key: RoleKey.SUPER_ADMIN }, select: { id: true } });
  if (!role) return;

  await prisma.userRole.upsert({
    where: { userId_roleId: { userId, roleId: role.id } },
    update: {},
    create: { userId, roleId: role.id },
  });
}
