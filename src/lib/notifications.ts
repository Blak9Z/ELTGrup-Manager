import { NotificationType, RoleKey } from "@prisma/client";
import { prisma } from "@/src/lib/prisma";

type NotificationPayload = {
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
};

export async function notifyUsers(args: NotificationPayload & { userIds: string[] }) {
  const userIds = Array.from(new Set(args.userIds.map((id) => id.trim()).filter(Boolean)));
  if (userIds.length === 0) return;

  await prisma.notification.createMany({
    data: userIds.map((userId) => ({
      userId,
      type: args.type,
      title: args.title,
      message: args.message,
      actionUrl: args.actionUrl,
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
  return prisma.notification.count({
    where: {
      userId,
      isRead: false,
    },
  });
}
