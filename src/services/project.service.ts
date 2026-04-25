import { prisma } from "@/src/lib/prisma";
import { ProjectStatus, ProjectType, Prisma, RoleKey, NotificationType, WorkOrderStatus } from "@prisma/client";
import { logActivity } from "@/src/lib/activity-log";
import { notifyRoles, notifyUser } from "@/src/lib/notifications";

export class ProjectService {
  static async getNextProjectCode() {
    const year = new Date().getFullYear();
    const prefix = `ELT-${year}-`;
    const codes = await prisma.project.findMany({
      where: { code: { startsWith: prefix } },
      select: { code: true },
    });

    let maxSequence = 0;
    for (const item of codes) {
      const maybeSequence = Number(item.code.slice(prefix.length));
      if (Number.isInteger(maybeSequence) && maybeSequence > maxSequence) {
        maxSequence = maybeSequence;
      }
    }

    return `${prefix}${String(maxSequence + 1).padStart(3, "0")}`;
  }

  static async create(data: {
    title: string;
    siteAddress: string;
    clientId: string;
    type: ProjectType;
    status: ProjectStatus;
    managerId: string;
    contractValue: number;
    estimatedBudget: number;
    startDate?: Date | null;
    endDate?: Date | null;
  }) {
    let created: Awaited<ReturnType<typeof prisma.project.create>> | null = null;
    
    // Retry logic for unique code generation
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const code = await this.getNextProjectCode();
      try {
        created = await prisma.project.create({
          data: {
            ...data,
            code,
            description: "Proiect creat din ProjectService",
          },
        });
        break;
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
          throw error;
        }
      }
    }

    if (!created) {
      throw new Error("Nu am putut genera un cod unic de proiect.");
    }

    await logActivity({
      userId: data.managerId,
      entityType: "PROJECT",
      entityId: created.id,
      action: "PROJECT_CREATED",
      diff: {
        title: created.title,
        status: created.status,
        type: created.type,
      },
    });

    await notifyRoles({
      roleKeys: [RoleKey.PROJECT_MANAGER, RoleKey.SITE_MANAGER, RoleKey.BACKOFFICE],
      type: NotificationType.NEW_ASSIGNMENT,
      title: "Proiect nou creat",
      message: `A fost creat proiectul ${created.title}.`,
      actionUrl: `/proiecte/${created.id}`,
    });

    return created;
  }

  static async updateStatus(id: string, status: ProjectStatus, actorId: string) {
    const before = await prisma.project.findUnique({
      where: { id },
      select: { status: true, title: true, managerId: true },
    });
    
    if (!before) throw new Error("Proiect inexistent.");

    const updated = await prisma.project.update({
      where: { id },
      data: { status },
      select: { id: true, title: true, status: true, managerId: true },
    });

    await logActivity({
      userId: actorId,
      entityType: "PROJECT",
      entityId: id,
      action: "PROJECT_STATUS_UPDATED",
      diff: { beforeStatus: before.status, afterStatus: updated.status },
    });

    if (status === "BLOCKED") {
      await notifyRoles({
        roleKeys: [RoleKey.ADMINISTRATOR, RoleKey.PROJECT_MANAGER],
        type: NotificationType.DELAYED_PROJECT,
        title: "Proiect blocat",
        message: `Proiectul ${updated.title} a fost marcat ca blocat.`,
        actionUrl: `/proiecte/${id}`,
      });
    }

    if (before.status !== updated.status && updated.managerId && updated.managerId !== actorId) {
      await notifyUser({
        userId: updated.managerId,
        type: updated.status === ProjectStatus.BLOCKED ? NotificationType.DELAYED_PROJECT : NotificationType.NEW_ASSIGNMENT,
        title: "Actualizare status proiect",
        message: `${updated.title} este acum ${updated.status}.`,
        actionUrl: `/proiecte/${updated.id}`,
      });
    }

    return updated;
  }

  static async softDelete(id: string, actorId: string) {
    const now = new Date();
    const project = await prisma.project.findUnique({
      where: { id },
      select: { id: true, title: true, deletedAt: true },
    });

    if (!project || project.deletedAt) throw new Error("Proiect inexistent sau deja arhivat.");

    const [projectsResult, workOrdersResult] = await prisma.$transaction([
      prisma.project.updateMany({
        where: { id, deletedAt: null },
        data: { deletedAt: now, status: ProjectStatus.CANCELED },
      }),
      prisma.workOrder.updateMany({
        where: { projectId: id, deletedAt: null },
        data: { deletedAt: now, status: WorkOrderStatus.CANCELED },
      }),
    ]);

    await logActivity({
      userId: actorId,
      entityType: "PROJECT",
      entityId: id,
      action: "PROJECT_SOFT_DELETED",
      diff: {
        title: project.title,
        archivedWorkOrders: workOrdersResult.count,
      },
    });

    return { archivedProjects: projectsResult.count, archivedWorkOrders: workOrdersResult.count };
  }
}
