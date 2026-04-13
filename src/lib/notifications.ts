import { NotificationType, RoleKey } from "@prisma/client";
import { unstable_cache } from "next/cache";
import { prisma } from "@/src/lib/prisma";

export async function notifyUser(args: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  actionUrl?: string;
}) {
  await prisma.notification.create({
    data: {
      userId: args.userId,
      type: args.type,
      title: args.title,
      message: args.message,
      actionUrl: args.actionUrl,
    },
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

  await prisma.notification.createMany({
    data: users.map((user) => ({
      userId: user.id,
      type: args.type,
      title: args.title,
      message: args.message,
      actionUrl: args.actionUrl,
    })),
  });
}

const getUnreadNotificationCountCached = unstable_cache(
  async (userId: string) =>
    prisma.notification.count({
      where: {
        userId,
        isRead: false,
      },
    }),
  ["unread-notification-count"],
  { revalidate: 15 },
);

export async function getUnreadNotificationCount(userId: string) {
  return getUnreadNotificationCountCached(userId);
}
