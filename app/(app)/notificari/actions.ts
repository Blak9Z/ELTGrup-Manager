"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";

export async function markNotificationRead(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Sesiune invalida");

  const id = String(formData.get("id"));
  await prisma.notification.updateMany({
    where: { id, userId: session.user.id },
    data: { isRead: true },
  });

  revalidatePath("/notificari");
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
