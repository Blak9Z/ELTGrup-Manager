import { NotificationType, Prisma, RoleKey } from "@prisma/client";
import { prisma } from "@/src/lib/prisma";

type NotificationPayload = {
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
};

const notificationFallbackTargets: Record<NotificationType, string> = {
  NEW_ASSIGNMENT: "/lucrari",
  OVERDUE_TASK: "/lucrari",
  LOW_STOCK: "/materiale",
  MISSING_DOCUMENT: "/documente",
  DELAYED_PROJECT: "/proiecte",
  TIMESHEET_APPROVAL_REQUIRED: "/pontaj",
  MATERIAL_REQUEST_APPROVAL_REQUIRED: "/materiale",
  INVOICE_OVERDUE: "/financiar",
  COMPLIANCE_DOCUMENT_EXPIRING: "/documente",
};

function isUsableAppRoute(route?: string | null) {
  const value = route?.trim();
  if (!value) return false;
  if (!value.startsWith("/")) return false;
  if (value.startsWith("//")) return false;
  if (value.includes("://")) return false;

  const path = value.split(/[?#]/, 1)[0];
  return path !== "/notificari" && !path.startsWith("/notificari/");
}

export function resolveNotificationTarget(type: NotificationType, actionUrl?: string | null): string {
  const normalizedActionUrl = actionUrl?.trim();
  const fallbackTarget = notificationFallbackTargets[type];
  if (isUsableAppRoute(normalizedActionUrl)) return normalizedActionUrl as string;
  return fallbackTarget ?? "/notificari";
}

export async function notifyUsers(args: NotificationPayload & { userIds: string[] }) {
  const userIds = Array.from(new Set(args.userIds.map((id) => id.trim()).filter(Boolean)));
  if (userIds.length === 0) return;
  const actionUrl = resolveNotificationTarget(args.type, args.actionUrl);

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: args.type,
      title: args.title,
      message: args.message,
      actionUrl,
    })),
  });
}

export async function notifyUser(args: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
}) {
  await notifyUsers({
    userIds: [args.userId],
    type: args.type,
    title: args.title,
    message: args.message,
    actionUrl: args.actionUrl,
  });
}

export async function notifyRoles(args: {
  roleKeys: RoleKey[];
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
}) {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      deletedAt: null,
      roles: { some: { role: { key: { in: args.roleKeys } } } },
    },
    select: { id: true },
  });

  if (users.length === 0) return;

  await notifyUsers({
    userIds: users.map((user) => user.id),
    type: args.type,
    title: args.title,
    message: args.message,
    actionUrl: args.actionUrl,
  });
}

export async function getUnreadNotificationCount(userId: string) {
  try {
    return await prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2024") {
      console.warn(`[notifications] Pool timeout while counting unread notifications for user ${userId}. Returning 0.`);
      return 0;
    }

    console.error("[notifications] Failed to count unread notifications.", error);
    return 0;
  }
}
