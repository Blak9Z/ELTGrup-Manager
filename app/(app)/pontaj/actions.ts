"use server";

import { NotificationType, RoleKey, TimeEntryStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertProjectAccess, assertWorkOrderAccess, resolveAccessScope } from "@/src/lib/access-scope";
import { logActivity } from "@/src/lib/activity-log";
import { ActionState, fromZodError } from "@/src/lib/action-state";
import { notifyRoles, notifyUser } from "@/src/lib/notifications";
import { requirePermission } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";
import { buildListHref } from "@/src/lib/query-params";

const STANDARD_SHIFT_END_HOUR = 17;

function buildPontajUrl(params: Record<string, string | undefined>) {
  return buildListHref("/pontaj", params);
}

const timeEntrySchema = z
  .object({
    projectId: z.string().cuid("Selecteaza un proiect valid."),
    userId: z.string().cuid("Selecteaza un angajat valid.").optional(),
    workOrderId: z.string().cuid("Selecteaza o lucrare valida.").optional(),
    shiftMode: z.enum(["STANDARD", "CUSTOM"]),
    startDate: z.string().min(1, "Selecteaza data de start."),
    startTime: z.string().min(1, "Selecteaza ora de start."),
    endDate: z.string().optional(),
    endTime: z.string().optional(),
    breakMinutes: z.coerce.number().min(0).max(600).default(0),
    note: z.string().max(1000, "Nota este prea lunga.").optional(),
  })
  .superRefine((data, ctx) => {
    const hasEndDate = Boolean(data.endDate?.trim());
    const hasEndTime = Boolean(data.endTime?.trim());

    if (data.shiftMode === "CUSTOM" && (!hasEndDate || !hasEndTime)) {
      if (!hasEndDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endDate"],
          message: "Pentru tura personalizata completeaza data de final.",
        });
      }
      if (!hasEndTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endTime"],
          message: "Pentru tura personalizata completeaza ora de final.",
        });
      }
    }

    if ((hasEndDate || hasEndTime) && (!hasEndDate || !hasEndTime)) {
      if (!hasEndDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endDate"],
          message: "Completeaza atat data, cat si ora de final.",
        });
      }
      if (!hasEndTime) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["endTime"],
          message: "Completeaza atat data, cat si ora de final.",
        });
      }
    }
  });

const bulkTimeEntrySchema = z.object({
  operation: z.enum(["APPROVE", "REJECT"]),
  ids: z.array(z.string().cuid()).min(1),
});
const approveTimeEntrySchema = z.object({
  id: z.string().cuid(),
});

function combineDateTime(date?: string, time?: string) {
  if (!date) return null;
  const normalizedTime = time && time.trim().length > 0 ? time : "00:00";
  return new Date(`${date}T${normalizedTime}`);
}

function getStandardShiftEndAt(startAt: Date) {
  const fallback = new Date(startAt);
  fallback.setHours(STANDARD_SHIFT_END_HOUR, 0, 0, 0);
  return fallback;
}

async function createTimeEntryInternal(formData: FormData) {
  const currentUser = await requirePermission("TIME_TRACKING", "CREATE");

  const parsed = timeEntrySchema.safeParse({
    projectId: formData.get("projectId"),
    userId: formData.get("userId") || undefined,
    workOrderId: formData.get("workOrderId") || undefined,
    shiftMode: formData.get("shiftMode") || "STANDARD",
    startDate: formData.get("startDate") || undefined,
    startTime: formData.get("startTime") || undefined,
    endDate: formData.get("endDate") || undefined,
    endTime: formData.get("endTime") || undefined,
    breakMinutes: formData.get("breakMinutes") || 0,
    note: formData.get("note") || undefined,
  });

  if (!parsed.success) throw parsed.error;
  await assertProjectAccess(currentUser, parsed.data.projectId);
  if (parsed.data.workOrderId) {
    await assertWorkOrderAccess(currentUser, parsed.data.workOrderId, { projectId: parsed.data.projectId });
  }

  const startAt = combineDateTime(parsed.data.startDate, parsed.data.startTime);
  const endAt = parsed.data.endDate && parsed.data.endTime ? combineDateTime(parsed.data.endDate, parsed.data.endTime) : null;

  if (!startAt || Number.isNaN(startAt.getTime())) {
    throw new Error("Selecteaza data si ora de inceput.");
  }

  if (endAt && Number.isNaN(endAt.getTime())) {
    throw new Error("Data/ora de final este invalida.");
  }

  const canManageTeamPontaj = currentUser.roleKeys.some((role) =>
    ["SUPER_ADMIN", "ADMINISTRATOR", "PROJECT_MANAGER", "SITE_MANAGER", "BACKOFFICE"].includes(role),
  );
  const targetUserId = parsed.data.userId || currentUser.id;
  if (!canManageTeamPontaj && targetUserId !== currentUser.id) {
    throw new Error("Poti adauga pontaj doar pentru contul tau.");
  }

  const computedEndAt = endAt || (parsed.data.shiftMode === "STANDARD" ? getStandardShiftEndAt(startAt) : null);
  if (!computedEndAt) {
    throw new Error("Pentru tura personalizata completeaza data si ora de final.");
  }
  if (computedEndAt < startAt) {
    if (parsed.data.shiftMode === "STANDARD") {
      throw new Error(`Tura standard se inchide la ${STANDARD_SHIFT_END_HOUR}:00. Completeaza finalul pentru un program mai lung.`);
    }
    throw new Error("Ora de final trebuie sa fie dupa ora de start.");
  }

  const targetUser = await prisma.user.findUnique({
    where: { id: targetUserId },
    select: { id: true, isActive: true, deletedAt: true },
  });
  if (!targetUser || !targetUser.isActive || targetUser.deletedAt) {
    throw new Error("Utilizatorul selectat nu este activ.");
  }

  const durationMinutes = Math.max(
    0,
    Math.round((computedEndAt.getTime() - startAt.getTime()) / 60000) - parsed.data.breakMinutes,
  );
  const overtimeMinutes = Math.max(0, durationMinutes - 8 * 60);

  const created = await prisma.timeEntry.create({
    data: {
      userId: targetUserId,
      projectId: parsed.data.projectId,
      workOrderId: parsed.data.workOrderId,
      startAt,
      endAt: computedEndAt,
      breakMinutes: parsed.data.breakMinutes,
      durationMinutes,
      overtimeMinutes,
      status: TimeEntryStatus.SUBMITTED,
      note: parsed.data.note,
    },
    include: {
      project: { select: { title: true } },
    },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "TIME_ENTRY",
    entityId: created.id,
    action: "TIME_ENTRY_CREATED",
    diff: {
      projectId: created.projectId,
      workOrderId: created.workOrderId,
      durationMinutes: created.durationMinutes,
      breakMinutes: created.breakMinutes,
    },
  });

  await notifyRoles({
    roleKeys: [RoleKey.ADMINISTRATOR, RoleKey.PROJECT_MANAGER, RoleKey.SITE_MANAGER, RoleKey.BACKOFFICE],
    type: NotificationType.TIMESHEET_APPROVAL_REQUIRED,
    title: "Pontaj nou pentru aprobare",
    message: `${created.project.title}: ${created.durationMinutes} minute raportate.`,
    actionUrl: buildPontajUrl({ status: TimeEntryStatus.SUBMITTED, projectId: created.projectId }),
  });

  revalidatePath("/pontaj");
  revalidatePath("/panou");
}

export async function createTimeEntryAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await createTimeEntryInternal(formData);
    return { ok: true, message: "Pontaj inregistrat cu succes." };
  } catch (error) {
    if (error instanceof z.ZodError) return fromZodError(error);
    return { ok: false, message: error instanceof Error ? error.message : "Eroare pontaj" };
  }
}

export async function approveTimeEntry(formData: FormData) {
  const currentUser = await requirePermission("TIME_TRACKING", "APPROVE");
  const parsed = approveTimeEntrySchema.safeParse({
    id: formData.get("id"),
  });
  if (!parsed.success) throw new Error("ID pontaj invalid.");
  const id = parsed.data.id;
  const current = await prisma.timeEntry.findUnique({
    where: { id },
    select: { projectId: true, status: true },
  });
  if (!current) throw new Error("Pontaj inexistent.");
  await assertProjectAccess(currentUser, current.projectId);
  if (current.status !== TimeEntryStatus.SUBMITTED) {
    throw new Error("Doar inregistrarile SUBMITTED pot fi aprobate.");
  }

  const entry = await prisma.timeEntry.update({
    where: { id },
    data: {
      status: TimeEntryStatus.APPROVED,
      approvedAt: new Date(),
      approvedById: currentUser.id,
    },
  });

  const worker = await prisma.workerProfile.findUnique({
    where: { userId: entry.userId },
    select: { hourlyRate: true },
  });
  const hourlyRate = Number(worker?.hourlyRate || 0);
  if (hourlyRate > 0) {
    const laborAmount = (entry.durationMinutes / 60) * hourlyRate;
    const existingLabor = await prisma.costEntry.findFirst({
      where: {
        projectId: entry.projectId,
        type: "LABOR",
        description: `Pontaj #${entry.id}`,
      },
      select: { id: true },
    });

    if (!existingLabor) {
      await prisma.costEntry.create({
        data: {
          projectId: entry.projectId,
          type: "LABOR",
          description: `Pontaj #${entry.id}`,
          amount: laborAmount,
          occurredAt: new Date(),
          approvedById: currentUser.id,
        },
      });
    }
  }

  await logActivity({
    userId: currentUser.id,
    entityType: "TIME_ENTRY",
    entityId: entry.id,
    action: "TIME_ENTRY_APPROVED",
  });

  if (entry.userId !== currentUser.id) {
    await notifyUser({
      userId: entry.userId,
      type: NotificationType.TIMESHEET_APPROVAL_REQUIRED,
      title: "Pontaj aprobat",
      message: "Inregistrarea ta de pontaj a fost aprobata.",
      actionUrl: buildPontajUrl({ status: TimeEntryStatus.APPROVED, projectId: entry.projectId }),
    });
  }

  revalidatePath("/pontaj");
  revalidatePath("/financiar");
  revalidatePath("/proiecte");
  revalidatePath("/panou");
}

export async function bulkTimeEntriesAction(formData: FormData) {
  const currentUser = await requirePermission("TIME_TRACKING", "APPROVE");

  const operation = String(formData.get("operation") || "");
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const parsed = bulkTimeEntrySchema.safeParse({ operation, ids });
  if (!parsed.success) throw new Error("Selectie bulk invalida pentru pontaj.");

  const status = parsed.data.operation === "APPROVE" ? TimeEntryStatus.APPROVED : TimeEntryStatus.REJECTED;
  const scope = await resolveAccessScope(currentUser);
  let scopedIds = parsed.data.ids;
  if (scope.projectIds !== null) {
    const allowed = await prisma.timeEntry.findMany({
      where: { id: { in: parsed.data.ids }, projectId: { in: scope.projectIds } },
      select: { id: true },
    });
    const allowedSet = new Set(allowed.map((row) => row.id));
    scopedIds = parsed.data.ids.filter((id) => allowedSet.has(id));
  }
  if (scopedIds.length === 0) throw new Error("Nu ai acces la pontajele selectate.");

  const now = new Date();
  const { submittedEntries, result } = await prisma.$transaction(async (tx) => {
    const submittedEntries = await tx.timeEntry.findMany({
      where: { id: { in: scopedIds }, status: TimeEntryStatus.SUBMITTED },
      select: { id: true, userId: true, projectId: true, durationMinutes: true },
    });

    const result = await tx.timeEntry.updateMany({
      where: { id: { in: scopedIds }, status: TimeEntryStatus.SUBMITTED },
      data: {
        status,
        approvedAt: now,
        approvedById: currentUser.id,
      },
    });

    if (parsed.data.operation === "APPROVE" && submittedEntries.length > 0) {
      const workerProfiles = await tx.workerProfile.findMany({
        where: { userId: { in: submittedEntries.map((entry) => entry.userId) } },
        select: { userId: true, hourlyRate: true },
      });
      const workerRateByUserId = new Map(workerProfiles.map((profile) => [profile.userId, Number(profile.hourlyRate || 0)]));

      for (const entry of submittedEntries) {
        const hourlyRate = workerRateByUserId.get(entry.userId) || 0;
        if (hourlyRate <= 0) continue;

        const description = `Pontaj #${entry.id}`;
        const existingLabor = await tx.costEntry.findFirst({
          where: {
            projectId: entry.projectId,
            type: "LABOR",
            description,
          },
          select: { id: true },
        });

        if (!existingLabor) {
          await tx.costEntry.create({
            data: {
              projectId: entry.projectId,
              type: "LABOR",
              description,
              amount: (entry.durationMinutes / 60) * hourlyRate,
              occurredAt: now,
              approvedById: currentUser.id,
            },
          });
        }
      }
    }

    return { submittedEntries, result };
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "TIME_ENTRY_BULK",
    entityId: "MULTI",
    action: `TIME_ENTRIES_${status}_BULK`,
    diff: { ids: scopedIds, affectedRows: result.count },
  });

  const notificationsPerUser = new Map<string, number>();
  for (const entry of submittedEntries) {
    if (entry.userId === currentUser.id) continue;
    notificationsPerUser.set(entry.userId, (notificationsPerUser.get(entry.userId) || 0) + 1);
  }

  await Promise.all(
    Array.from(notificationsPerUser.entries()).map(([userId, count]) =>
      notifyUser({
        userId,
        type: NotificationType.TIMESHEET_APPROVAL_REQUIRED,
        title: status === TimeEntryStatus.APPROVED ? "Pontaj aprobat" : "Pontaj respins",
        message:
          status === TimeEntryStatus.APPROVED
            ? `${count} ${count === 1 ? "inregistrare" : "inregistrari"} de pontaj au fost aprobate.`
            : `${count} ${count === 1 ? "inregistrare" : "inregistrari"} de pontaj au fost respinse.`,
        actionUrl: buildPontajUrl({ status }),
      }),
    ),
  );

  revalidatePath("/pontaj");
  if (status === TimeEntryStatus.APPROVED) {
    revalidatePath("/financiar");
    revalidatePath("/proiecte");
  }
  revalidatePath("/panou");
}
