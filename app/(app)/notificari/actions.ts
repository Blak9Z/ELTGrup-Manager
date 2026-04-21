"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { resolveNotificationTarget } from "@/src/lib/notifications";

export async function markNotificationRead(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sesiune invalida");

  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Notificare invalida.");
  await prisma.notification.updateMany({
    where: { id, userId: session.user.id, isRead: false },
    data: { isRead: true },
  });

  revalidatePath("/notificari");
}

export async function markNotificationReadAndOpen(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sesiune invalida");

  const id = String(formData.get("id") || "");
  if (!id) throw new Error("Notificare invalida.");

  const notification = await prisma.notification.findFirst({
    where: { id, userId: session.user.id },
    select: { actionUrl: true, type: true },
  });

  if (!notification) throw new Error("Notificare invalida.");

  await prisma.notification.updateMany({
    where: { id, userId: session.user.id, isRead: false },
    data: { isRead: true },
  });

  revalidatePath("/notificari");
  redirect(resolveNotificationTarget(notification.type, notification.actionUrl));
}

export async function markAllNotificationsRead() {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sesiune invalida");

  await prisma.notification.updateMany({
    where: { userId: session.user.id, isRead: false },
    data: { isRead: true },
  });

  revalidatePath("/notificari");
}
