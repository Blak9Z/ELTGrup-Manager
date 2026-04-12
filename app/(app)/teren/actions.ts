"use server";

import { TimeEntryLiveState, TimeEntryStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/src/lib/activity-log";
import { requirePermission } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";
import { uploadDocumentFile } from "@/src/lib/storage";

const startSchema = z.object({
  workOrderId: z.string().cuid(),
  projectId: z.string().cuid(),
  note: z.string().optional(),
});

const geoSchema = z.object({
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
});

const fileSchema = z.object({
  workOrderId: z.string().cuid(),
  projectId: z.string().cuid(),
  note: z.string().optional(),
});

function todayDateAtMidnight() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

export async function startLivePontaj(formData: FormData) {
  const currentUser = await requirePermission("TIME_TRACKING", "CREATE");

  const parsed = startSchema.safeParse({
    workOrderId: formData.get("workOrderId"),
    projectId: formData.get("projectId"),
    note: formData.get("note") || undefined,
  });

  if (!parsed.success) throw new Error("Date invalide pentru start pontaj.");

  const existing = await prisma.timeEntry.findFirst({
    where: {
      userId: currentUser.id,
      endAt: null,
      liveState: { in: [TimeEntryLiveState.RUNNING, TimeEntryLiveState.PAUSED] },
    },
    select: { id: true },
  });

  if (existing) throw new Error("Ai deja un pontaj live activ.");

  const created = await prisma.timeEntry.create({
    data: {
      userId: currentUser.id,
      projectId: parsed.data.projectId,
      workOrderId: parsed.data.workOrderId,
      startAt: new Date(),
      status: TimeEntryStatus.DRAFT,
      liveState: TimeEntryLiveState.RUNNING,
      note: parsed.data.note,
    },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "TIME_ENTRY",
    entityId: created.id,
    action: "LIVE_TIME_STARTED",
  });

  revalidatePath("/teren");
  revalidatePath("/pontaj");
}

export async function pauseLivePontaj(formData: FormData) {
  const currentUser = await requirePermission("TIME_TRACKING", "UPDATE");
  const id = String(formData.get("id"));

  const current = await prisma.timeEntry.findFirst({
    where: { id, userId: currentUser.id, endAt: null, liveState: TimeEntryLiveState.RUNNING },
  });
  if (!current) throw new Error("Pontajul nu poate fi pus pe pauza.");

  await prisma.timeEntry.update({
    where: { id },
    data: {
      liveState: TimeEntryLiveState.PAUSED,
      pausedAt: new Date(),
    },
  });

  await logActivity({ userId: currentUser.id, entityType: "TIME_ENTRY", entityId: id, action: "LIVE_TIME_PAUSED" });

  revalidatePath("/teren");
}

export async function resumeLivePontaj(formData: FormData) {
  const currentUser = await requirePermission("TIME_TRACKING", "UPDATE");
  const id = String(formData.get("id"));

  const current = await prisma.timeEntry.findFirst({
    where: { id, userId: currentUser.id, endAt: null, liveState: TimeEntryLiveState.PAUSED },
  });
  if (!current) throw new Error("Pontajul nu poate fi reluat.");

  const extraPause = current.pausedAt
    ? Math.max(0, Math.round((Date.now() - current.pausedAt.getTime()) / 60000))
    : 0;

  await prisma.timeEntry.update({
    where: { id },
    data: {
      liveState: TimeEntryLiveState.RUNNING,
      pausedAt: null,
      pauseAccumulatedMinutes: current.pauseAccumulatedMinutes + extraPause,
    },
  });

  await logActivity({ userId: currentUser.id, entityType: "TIME_ENTRY", entityId: id, action: "LIVE_TIME_RESUMED" });

  revalidatePath("/teren");
}

export async function stopLivePontaj(formData: FormData) {
  const currentUser = await requirePermission("TIME_TRACKING", "UPDATE");
  const id = String(formData.get("id"));

  const current = await prisma.timeEntry.findFirst({
    where: { id, userId: currentUser.id, endAt: null, liveState: { in: [TimeEntryLiveState.RUNNING, TimeEntryLiveState.PAUSED] } },
  });
  if (!current) throw new Error("Pontajul nu poate fi oprit.");

  const now = new Date();
  const extraPause = current.liveState === TimeEntryLiveState.PAUSED && current.pausedAt
    ? Math.max(0, Math.round((now.getTime() - current.pausedAt.getTime()) / 60000))
    : 0;

  const totalPause = current.pauseAccumulatedMinutes + extraPause;
  const duration = Math.max(0, Math.round((now.getTime() - current.startAt.getTime()) / 60000) - totalPause);
  const overtime = Math.max(0, duration - 480);

  await prisma.timeEntry.update({
    where: { id },
    data: {
      endAt: now,
      liveState: TimeEntryLiveState.STOPPED,
      pausedAt: null,
      pauseAccumulatedMinutes: totalPause,
      breakMinutes: totalPause,
      durationMinutes: duration,
      overtimeMinutes: overtime,
      status: TimeEntryStatus.SUBMITTED,
    },
  });

  await logActivity({ userId: currentUser.id, entityType: "TIME_ENTRY", entityId: id, action: "LIVE_TIME_STOPPED", diff: { duration } });

  revalidatePath("/teren");
  revalidatePath("/pontaj");
  revalidatePath("/panou");
}

export async function checkInOnSite(formData: FormData) {
  const currentUser = await requirePermission("TIME_TRACKING", "CREATE");
  const parsed = geoSchema.safeParse({
    latitude: formData.get("latitude") || undefined,
    longitude: formData.get("longitude") || undefined,
  });
  if (!parsed.success) throw new Error("Coordonate invalide");

  const date = todayDateAtMidnight();
  await prisma.attendance.upsert({
    where: { userId_date: { userId: currentUser.id, date } },
    update: {
      checkInAt: new Date(),
      gpsLatitude: parsed.data.latitude,
      gpsLongitude: parsed.data.longitude,
      status: "PRESENT",
    },
    create: {
      userId: currentUser.id,
      date,
      checkInAt: new Date(),
      gpsLatitude: parsed.data.latitude,
      gpsLongitude: parsed.data.longitude,
      status: "PRESENT",
    },
  });

  revalidatePath("/teren");
}

export async function checkOutOnSite(formData: FormData) {
  const currentUser = await requirePermission("TIME_TRACKING", "UPDATE");
  const parsed = geoSchema.safeParse({
    latitude: formData.get("latitude") || undefined,
    longitude: formData.get("longitude") || undefined,
  });
  if (!parsed.success) throw new Error("Coordonate invalide");

  const date = todayDateAtMidnight();
  await prisma.attendance.upsert({
    where: { userId_date: { userId: currentUser.id, date } },
    update: {
      checkOutAt: new Date(),
      gpsLatitude: parsed.data.latitude,
      gpsLongitude: parsed.data.longitude,
      status: "PRESENT",
    },
    create: {
      userId: currentUser.id,
      date,
      checkOutAt: new Date(),
      gpsLatitude: parsed.data.latitude,
      gpsLongitude: parsed.data.longitude,
      status: "PRESENT",
    },
  });

  revalidatePath("/teren");
}

export async function uploadTaskPhoto(formData: FormData) {
  const currentUser = await requirePermission("DOCUMENTS", "CREATE");
  const parsed = fileSchema.safeParse({
    workOrderId: formData.get("workOrderId"),
    projectId: formData.get("projectId"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) throw new Error("Date foto invalide");

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Fisier foto lipsa");

  const uploaded = await uploadDocumentFile(file);

  const created = await prisma.document.create({
    data: {
      category: "PHOTO",
      title: `Foto teren ${new Date().toLocaleString("ro-RO")}`,
      fileName: uploaded.fileName,
      storagePath: uploaded.storagePath,
      mimeType: uploaded.mimeType,
      projectId: parsed.data.projectId,
      workOrderId: parsed.data.workOrderId,
      uploadedById: currentUser.id,
      tags: ["teren", "foto"],
    },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "DOCUMENT",
    entityId: created.id,
    action: "FIELD_PHOTO_UPLOADED",
    diff: { workOrderId: parsed.data.workOrderId },
  });

  revalidatePath("/teren");
  revalidatePath("/documente");
}

export async function uploadTaskSignature(formData: FormData) {
  const currentUser = await requirePermission("DOCUMENTS", "CREATE");
  const parsed = fileSchema.safeParse({
    workOrderId: formData.get("workOrderId"),
    projectId: formData.get("projectId"),
    note: formData.get("note") || undefined,
  });
  if (!parsed.success) throw new Error("Date semnatura invalide");

  const file = formData.get("file");
  if (!(file instanceof File)) throw new Error("Fisier semnatura lipsa");

  const uploaded = await uploadDocumentFile(file);

  const created = await prisma.document.create({
    data: {
      category: "HANDOVER",
      title: `Semnatura client ${new Date().toLocaleString("ro-RO")}`,
      fileName: uploaded.fileName,
      storagePath: uploaded.storagePath,
      mimeType: uploaded.mimeType,
      projectId: parsed.data.projectId,
      workOrderId: parsed.data.workOrderId,
      uploadedById: currentUser.id,
      tags: ["teren", "semnatura"],
    },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "DOCUMENT",
    entityId: created.id,
    action: "FIELD_SIGNATURE_UPLOADED",
    diff: { workOrderId: parsed.data.workOrderId },
  });

  revalidatePath("/teren");
  revalidatePath("/documente");
}
