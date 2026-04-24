"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requirePermission } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";
import { resolveNotificationTarget } from "@/src/lib/notifications";

export async function markNotificationRead(formData: FormData) {
  const currentUser = await requirePermission("REPORTS", "VIEW");

  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Notificare invalida.");
  await prisma.notification.updateMany({
    where: { id, userId: currentUser.id, isRead: false },
    data: { isRead: true },
  });

  revalidatePath("/notificari");
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

  revalidatePath("/notificari");
  redirect(resolveNotificationTarget(notification.type, notification.actionUrl));
}

export async function markAllNotificationsRead() {
  const currentUser = await requirePermission("REPORTS", "VIEW");

  await prisma.notification.updateMany({
    where: { userId: currentUser.id, isRead: false },
    data: { isRead: true },
  });

  revalidatePath("/notificari");
}
