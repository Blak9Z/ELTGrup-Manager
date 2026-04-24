"use server";

import { ProjectStatus, RoleKey, WorkOrderStatus } from "@prisma/client";
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

const DEMO_CLEANUP_CONFIRM_TEXT = "STERGE DATELE DEMO";

const demoSeedMarkers = {
  users: [
    "seed.superadmin@eltgrup.local",
    "seed.manager@eltgrup.local",
    "seed.site@eltgrup.local",
    "seed.worker@eltgrup.local",
  ],
  workerProfileCode: "EMP-ONB-001",
  projectCode: "ONB-2026-001",
  teamCode: "TEAM-ONB-001",
  clientName: "ELTGRUP Onboarding Client SRL",
  clientEmail: "onboarding@eltgrup.local",
  invoiceNumber: "ONB-INV-2026-001",
  warehouseCode: "DEP-ONB-001",
  inventoryCategoryCode: "SCULE_ELECTRICE",
  inventoryCategoryDescription: "Categorie minima pentru onboarding.",
  inventoryLocationCode: "DEP-ONB-A1",
  inventoryItemCode: "SC-ONB-001",
} as const;

function hasCleanupAdminRole(roleKeys: Array<string | RoleKey>) {
  const normalizedRoleKeys = new Set(roleKeys.map((roleKey) => String(roleKey)));
  return normalizedRoleKeys.has(RoleKey.SUPER_ADMIN) || normalizedRoleKeys.has(RoleKey.ADMINISTRATOR);
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

const cleanupDemoDataSchema = z.object({
  confirmationText: z.string().trim().min(1),
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
  if (targetHasSuperAdmin && !actorHasSuperAdmin) {
    throw new Error("Doar un utilizator cu rol SUPER_ADMIN poate modifica rolul unui alt SUPER_ADMIN.");
  }

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
  const actorHasSuperAdmin = hasSuperAdminRole(actor.roleKeys || []);
  if (targetHasSuperAdmin && !actorHasSuperAdmin) {
    throw new Error("Doar un utilizator cu rol SUPER_ADMIN poate activa/dezactiva un SUPER_ADMIN.");
  }
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

  await logActivity({
    userId: actor.id,
    entityType: "USER",
    entityId: target.id,
    action: "USER_ACTIVE_TOGGLED",
    diff: { previousIsActive: target.isActive, nextIsActive: !target.isActive },
  });

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
  const actorHasSuperAdmin = hasSuperAdminRole(actor.roleKeys || []);
  if (targetHasSuperAdmin && !actorHasSuperAdmin) {
    throw new Error("Doar un utilizator cu rol SUPER_ADMIN poate sterge un alt SUPER_ADMIN.");
  }
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

  await logActivity({
    userId: actor.id,
    entityType: "USER",
    entityId: target.id,
    action: "USER_DELETED",
    diff: { targetEmail: target.email, deletedAt: deletedAt.toISOString() },
  });

  revalidatePath("/setari");
}

export async function cleanupDemoDataAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const actor = await requirePermission("SETTINGS", "DELETE");
    if (!hasCleanupAdminRole(actor.roleKeys || [])) {
      return { ok: false, message: "Doar SUPER_ADMIN sau ADMINISTRATOR poate executa aceasta curatare." };
    }

    const parsed = cleanupDemoDataSchema.safeParse({
      confirmationText: formData.get("confirmationText"),
    });

    if (!parsed.success) {
      return { ok: false, message: "Text de confirmare invalid." };
    }

    if (parsed.data.confirmationText !== DEMO_CLEANUP_CONFIRM_TEXT) {
      return { ok: false, message: `Scrie exact "${DEMO_CLEANUP_CONFIRM_TEXT}" pentru confirmare.` };
    }

    const now = new Date();

    const cleanupSummary = await prisma.$transaction(async (tx) => {
      const summary = {
        projectsArchived: 0,
        workOrdersArchived: 0,
        clientsArchived: 0,
        teamsArchived: 0,
        workerProfilesArchived: 0,
        documentsDeleted: 0,
        reportsDeleted: 0,
        commentsDeleted: 0,
        invoicesDeleted: 0,
        costsDeleted: 0,
        notificationsDeleted: 0,
        inventoryItemsDeleted: 0,
        inventoryAssignmentsDeleted: 0,
        inventoryMovementsDeleted: 0,
        inventoryInspectionsDeleted: 0,
        inventoryLocationsDeleted: 0,
        inventoryCategoriesDeleted: 0,
        warehousesDeleted: 0,
        warehousesArchived: 0,
        seedUsersArchived: 0,
        seedUsersProtected: 0,
      };

      const project = await tx.project.findUnique({
        where: { code: demoSeedMarkers.projectCode },
        select: { id: true },
      });
      const team = await tx.team.findUnique({
        where: { code: demoSeedMarkers.teamCode },
        select: { id: true },
      });
      const clients = await tx.client.findMany({
        where: {
          deletedAt: null,
          OR: [
            { name: demoSeedMarkers.clientName },
            { email: demoSeedMarkers.clientEmail },
          ],
        },
        select: { id: true },
      });
      const clientIds = clients.map((client) => client.id);

      const workOrders = project
        ? await tx.workOrder.findMany({
            where: { projectId: project.id },
            select: { id: true },
          })
        : [];
      const workOrderIds = workOrders.map((workOrder) => workOrder.id);

      if (workOrderIds.length > 0) {
        const deletedComments = await tx.comment.deleteMany({
          where: { workOrderId: { in: workOrderIds } },
        });
        summary.commentsDeleted += deletedComments.count;
      }

      if (project) {
        const reportWhereClauses = [
          { projectId: project.id },
          workOrderIds.length > 0 ? { workOrderId: { in: workOrderIds } } : undefined,
        ].filter((value): value is Exclude<typeof value, undefined> => Boolean(value));
        const deletedReports = await tx.dailySiteReport.deleteMany({
          where: { OR: reportWhereClauses },
        });
        summary.reportsDeleted += deletedReports.count;
      }

      const documentWhereClauses = [
        project ? { projectId: project.id } : undefined,
        clientIds.length > 0 ? { clientId: { in: clientIds } } : undefined,
        workOrderIds.length > 0 ? { workOrderId: { in: workOrderIds } } : undefined,
      ].filter((value): value is Exclude<typeof value, undefined> => Boolean(value));
      if (documentWhereClauses.length > 0) {
        const deletedDocuments = await tx.document.deleteMany({
          where: { OR: documentWhereClauses },
        });
        summary.documentsDeleted += deletedDocuments.count;
      }

      const invoiceWhereClauses = [
        { invoiceNumber: demoSeedMarkers.invoiceNumber },
        project ? { projectId: project.id } : undefined,
        clientIds.length > 0 ? { clientId: { in: clientIds } } : undefined,
      ].filter((value): value is Exclude<typeof value, undefined> => Boolean(value));
      if (invoiceWhereClauses.length > 0) {
        const deletedInvoices = await tx.invoice.deleteMany({
          where: { OR: invoiceWhereClauses },
        });
        summary.invoicesDeleted += deletedInvoices.count;
      }

      if (project) {
        const deletedCosts = await tx.costEntry.deleteMany({ where: { projectId: project.id } });
        summary.costsDeleted += deletedCosts.count;
      }

      if (workOrderIds.length > 0) {
        const archivedWorkOrders = await tx.workOrder.updateMany({
          where: { id: { in: workOrderIds }, deletedAt: null },
          data: { deletedAt: now, status: WorkOrderStatus.CANCELED },
        });
        summary.workOrdersArchived += archivedWorkOrders.count;
      }

      if (project) {
        const archivedProjects = await tx.project.updateMany({
          where: { id: project.id, deletedAt: null },
          data: { deletedAt: now, status: ProjectStatus.CANCELED },
        });
        summary.projectsArchived += archivedProjects.count;
      }

      if (team) {
        await tx.workerProfile.updateMany({
          where: { teamId: team.id },
          data: { teamId: null },
        });
        const archivedTeams = await tx.team.updateMany({
          where: { id: team.id, deletedAt: null },
          data: { deletedAt: now, isActive: false },
        });
        summary.teamsArchived += archivedTeams.count;
      }

      const archivedClients = await tx.client.updateMany({
        where: {
          id: { in: clientIds },
          deletedAt: null,
        },
        data: { deletedAt: now },
      });
      summary.clientsArchived += archivedClients.count;

      const archivedProfiles = await tx.workerProfile.updateMany({
        where: { employeeCode: demoSeedMarkers.workerProfileCode, deletedAt: null },
        data: { deletedAt: now, teamId: null },
      });
      summary.workerProfilesArchived += archivedProfiles.count;

      const inventoryItem = await tx.inventoryItem.findUnique({
        where: { internalCode: demoSeedMarkers.inventoryItemCode },
        select: { id: true },
      });

      if (inventoryItem) {
        const deletedAssignments = await tx.inventoryAssignment.deleteMany({
          where: { itemId: inventoryItem.id },
        });
        summary.inventoryAssignmentsDeleted += deletedAssignments.count;

        const deletedMovements = await tx.inventoryMovement.deleteMany({
          where: { itemId: inventoryItem.id },
        });
        summary.inventoryMovementsDeleted += deletedMovements.count;

        const deletedInspections = await tx.inventoryInspectionRecord.deleteMany({
          where: { itemId: inventoryItem.id },
        });
        summary.inventoryInspectionsDeleted += deletedInspections.count;

        const deletedItems = await tx.inventoryItem.deleteMany({
          where: { id: inventoryItem.id },
        });
        summary.inventoryItemsDeleted += deletedItems.count;
      }

      const deletedLocations = await tx.inventoryLocation.deleteMany({
        where: { code: demoSeedMarkers.inventoryLocationCode },
      });
      summary.inventoryLocationsDeleted += deletedLocations.count;

      const category = await tx.inventoryCategory.findUnique({
        where: { code: demoSeedMarkers.inventoryCategoryCode },
        select: { id: true, description: true },
      });

      if (category && category.description === demoSeedMarkers.inventoryCategoryDescription) {
        const linkedItemCount = await tx.inventoryItem.count({ where: { categoryId: category.id } });
        if (linkedItemCount === 0) {
          const deletedCategories = await tx.inventoryCategory.deleteMany({ where: { id: category.id } });
          summary.inventoryCategoriesDeleted += deletedCategories.count;
        }
      }

      const warehouse = await tx.warehouse.findUnique({
        where: { code: demoSeedMarkers.warehouseCode },
        select: { id: true, deletedAt: true },
      });

      if (warehouse) {
        const [linkedInventoryItems, linkedInventoryLocations, linkedInventoryMovements, linkedStockMovements] = await Promise.all([
          tx.inventoryItem.count({ where: { warehouseId: warehouse.id } }),
          tx.inventoryLocation.count({ where: { warehouseId: warehouse.id } }),
          tx.inventoryMovement.count({ where: { warehouseId: warehouse.id } }),
          tx.stockMovement.count({ where: { warehouseId: warehouse.id } }),
        ]);

        if (linkedInventoryItems === 0 && linkedInventoryLocations === 0 && linkedInventoryMovements === 0 && linkedStockMovements === 0) {
          const deletedWarehouses = await tx.warehouse.deleteMany({ where: { id: warehouse.id } });
          summary.warehousesDeleted += deletedWarehouses.count;
        } else if (!warehouse.deletedAt) {
          const archivedWarehouses = await tx.warehouse.updateMany({
            where: { id: warehouse.id, deletedAt: null },
            data: { deletedAt: now },
          });
          summary.warehousesArchived += archivedWarehouses.count;
        }
      }

      const seedUsers = await tx.user.findMany({
        where: { email: { in: [...demoSeedMarkers.users] } },
        include: {
          roles: { include: { role: { select: { key: true } } } },
        },
      });

      let activeSuperAdmins = await tx.userRole.count({
        where: {
          role: { key: RoleKey.SUPER_ADMIN },
          user: { deletedAt: null, isActive: true },
        },
      });

      for (const user of seedUsers) {
        if (user.id === actor.id) {
          summary.seedUsersProtected += 1;
          continue;
        }

        const isSuperAdminUser = user.roles.some((membership) => membership.role.key === RoleKey.SUPER_ADMIN);
        if (isSuperAdminUser && user.isActive && activeSuperAdmins <= 1) {
          summary.seedUsersProtected += 1;
          continue;
        }

        await tx.session.deleteMany({ where: { userId: user.id } });
        await tx.account.deleteMany({ where: { userId: user.id } });
        await tx.userRole.deleteMany({ where: { userId: user.id } });
        await tx.workerProfile.updateMany({
          where: { userId: user.id, deletedAt: null },
          data: { deletedAt: now, teamId: null },
        });
        await tx.user.update({
          where: { id: user.id },
          data: {
            isActive: false,
            deletedAt: now,
            email: buildDeletedEmail(user.email, user.id),
          },
        });

        summary.seedUsersArchived += 1;
        if (isSuperAdminUser && user.isActive) {
          activeSuperAdmins -= 1;
        }
      }

      const notificationUserIds = seedUsers
        .filter((user) => user.id !== actor.id)
        .map((user) => user.id);

      if (notificationUserIds.length > 0) {
        const deletedNotifications = await tx.notification.deleteMany({
          where: { userId: { in: notificationUserIds } },
        });
        summary.notificationsDeleted += deletedNotifications.count;
      }

      return summary;
    });

    await logActivity({
      userId: actor.id,
      entityType: "SETTINGS",
      entityId: "DEMO_SEED_CLEANUP",
      action: "DEMO_ONBOARDING_DATA_CLEANUP_EXECUTED",
      diff: {
        ...cleanupSummary,
        confirmationText: DEMO_CLEANUP_CONFIRM_TEXT,
        preservedCurrentUserId: actor.id,
      },
    });

    for (const path of [
      "/setari",
      "/panou",
      "/proiecte",
      "/lucrari",
      "/clienti",
      "/materiale",
      "/documente",
      "/financiar",
      "/notificari",
      "/rapoarte-zilnice",
      "/subcontractori",
      "/gestiune-scule",
      "/analitice",
    ]) {
      revalidatePath(path);
    }

    const changedItemsCount = Object.entries(cleanupSummary)
      .filter(([key]) => key !== "seedUsersProtected")
      .reduce((total, [, count]) => total + count, 0);

    if (changedItemsCount === 0) {
      return { ok: true, message: "Nu au fost gasite inregistrari onboarding/demo eligibile pentru curatare." };
    }

    return { ok: true, message: "Curatarea onboarding/demo a fost executata cu succes." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Curatarea datelor demo a esuat." };
  }
}
