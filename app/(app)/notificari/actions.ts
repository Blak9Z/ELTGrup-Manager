"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { logActivity } from "@/src/lib/activity-log";
import { requirePermission } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";
import { resolveNotificationTarget } from "@/src/lib/notifications";

const notificationIdSchema = z.object({
  id: z.string().cuid(),
});

function revalidateNotificationPaths() {
  revalidatePath("/notificari");
  revalidatePath("/panou");
}

export async function markNotificationRead(formData: FormData) {
  const currentUser = await requirePermission("REPORTS", "VIEW");

  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Notificare invalida.");
  await prisma.notification.updateMany({
    where: { id, userId: currentUser.id, isRead: false },
    data: { isRead: true },
  });

  revalidateNotificationPaths();
}

export async function markNotificationReadAndOpen(formData: FormData) {
  const currentUser = await requirePermission("REPORTS", "VIEW");

  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Notificare invalida.");

  const notification = await prisma.notification.findFirst({
    where: { id, userId: currentUser.id },
    select: { actionUrl: true, type: true },
  });

  if (!notification) throw new Error("Notificare invalida.");

  await prisma.notification.updateMany({
    where: { id, userId: currentUser.id, isRead: false },
    data: { isRead: true },
  });

  revalidateNotificationPaths();
  redirect(resolveNotificationTarget(notification.type, notification.actionUrl));
}

export async function markAllNotificationsRead() {
  const currentUser = await requirePermission("REPORTS", "VIEW");

  await prisma.notification.updateMany({
    where: { userId: currentUser.id, isRead: false },
    data: { isRead: true },
  });

  revalidateNotificationPaths();
}

export async function deleteNotification(formData: FormData) {
  const currentUser = await requirePermission("REPORTS", "VIEW");
  const parsed = notificationIdSchema.safeParse({
    id: formData.get("id"),
  });
  if (!parsed.success) throw new Error("Notificare invalida pentru stergere.");

  const notification = await prisma.notification.findFirst({
    where: { id: parsed.data.id, userId: currentUser.id },
    select: { id: true, type: true, title: true, isRead: true, actionUrl: true },
  });
  if (!notification) throw new Error("Notificarea nu exista sau nu iti apartine.");

  await prisma.notification.delete({
    where: { id: notification.id },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "NOTIFICATION",
    entityId: notification.id,
    action: "NOTIFICATION_DELETED",
    diff: {
      type: notification.type,
      title: notification.title,
      isRead: notification.isRead,
      actionUrl: notification.actionUrl,
    },
  });

  revalidateNotificationPaths();
}

export async function clearReadNotifications() {
  const currentUser = await requirePermission("REPORTS", "VIEW");

  const result = await prisma.notification.deleteMany({
    where: { userId: currentUser.id, isRead: true },
  });
  if (result.count === 0) throw new Error("Nu exista notificari citite pentru stergere.");

  await logActivity({
    userId: currentUser.id,
    entityType: "NOTIFICATION_BULK",
    entityId: "MULTI",
    action: "NOTIFICATIONS_READ_DELETED_BULK",
    diff: { deletedCount: result.count },
  });

  revalidateNotificationPaths();
}
