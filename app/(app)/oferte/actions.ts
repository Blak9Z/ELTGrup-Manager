"use server";

import { OfferStatus, Prisma, ProjectStatus, ProjectType } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/src/lib/activity-log";
import { ActionState } from "@/src/lib/action-state";
import { requirePermission } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";

function revalidateOfferPaths() {
  revalidatePath("/oferte");
  revalidatePath("/panou");
}

const createOfferSchema = z.object({
  title: z.string().min(3),
  clientId: z.string().min(1),
  type: z.nativeEnum(ProjectType).optional(),
  validUntil: z.string().min(1),
  totalAmount: z.coerce.number().min(0),
  currency: z.string().default("RON"),
  notes: z.string().optional(),
  description: z.string().optional(),
});

const offerItemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  category: z.string().optional(),
  quantity: z.coerce.number().min(0.01),
  unitPrice: z.coerce.number().min(0),
});

async function getNextOfferCode() {
  const year = new Date().getFullYear();
  const prefix = `OFE-${year}-`;
  const codes = await prisma.offer.findMany({
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

export async function createOfferAction(_: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requirePermission("PROJECTS", "CREATE");

  const raw: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (key.startsWith("item-")) continue;
    raw[key] = value;
  }

  const parsed = createOfferSchema.safeParse(raw);
  if (!parsed.success) {
    return { ok: false, message: "Date invalide.", errors: parsed.error.flatten().fieldErrors };
  }

  // Parse items from formData
  const items: Array<z.infer<typeof offerItemSchema>> = [];
  const itemMap = new Map<number, Record<string, string>>();
  for (const [key, value] of formData.entries()) {
    if (!key.startsWith("item-")) continue;
    const match = key.match(/^item-(\d+)-(.+)$/);
    if (!match) continue;
    const idx = Number(match[1]);
    const field = match[2];
    if (!itemMap.has(idx)) itemMap.set(idx, {});
    itemMap.get(idx)![field] = String(value);
  }
  for (const [, fields] of itemMap) {
    const itemParsed = offerItemSchema.safeParse({
      name: fields.name,
      description: fields.description,
      category: fields.category,
      quantity: fields.quantity,
      unitPrice: fields.unitPrice,
    });
    if (itemParsed.success) items.push(itemParsed.data);
  }

  try {
    const code = await getNextOfferCode();
    const validUntil = parsed.data.validUntil ? new Date(parsed.data.validUntil + "T23:59:59") : new Date();

    const offer = await prisma.offer.create({
      data: {
        code,
        title: parsed.data.title,
        description: parsed.data.description || null,
        clientId: parsed.data.clientId,
        status: OfferStatus.DRAFT,
        issueDate: new Date(),
        validUntil,
        totalAmount: new Prisma.Decimal(parsed.data.totalAmount),
        currency: parsed.data.currency,
        notes: parsed.data.notes || null,
        items: items.length
          ? {
              create: items.map((item, index) => ({
                name: item.name,
                description: item.description || null,
                category: item.category || null,
                quantity: new Prisma.Decimal(item.quantity),
                unitPrice: new Prisma.Decimal(item.unitPrice),
                totalPrice: new Prisma.Decimal(item.quantity * item.unitPrice),
                sortOrder: index,
              })),
            }
          : undefined,
      },
    });

    await logActivity({
      userId: user.id,
      entityType: "OFFER",
      entityId: offer.id,
      action: "OFFER_CREATED",
      diff: { code, title: parsed.data.title, clientId: parsed.data.clientId, totalAmount: parsed.data.totalAmount },
    });

    revalidateOfferPaths();
    return { ok: true, message: `Oferta ${code} a fost creata.` };
  } catch (_err) {
    return { ok: false, message: "Eroare la crearea ofertei." };
  }
}

const updateOfferStatusSchema = z.object({
  id: z.string().cuid(),
  status: z.nativeEnum(OfferStatus),
});

export async function updateOfferStatus(formData: FormData) {
  const user = await requirePermission("OFFERS", "UPDATE");
  const raw = Object.fromEntries(formData.entries());
  const parsed = updateOfferStatusSchema.safeParse(raw);
  if (!parsed.success) return;

  const offer = await prisma.offer.findUnique({
    where: { id: parsed.data.id, deletedAt: null },
    select: { status: true },
  });
  if (!offer) return;

  const now = new Date();
  const updateData: Prisma.OfferUpdateInput = { status: parsed.data.status };
  if (parsed.data.status === OfferStatus.ACCEPTED && offer.status !== OfferStatus.ACCEPTED) {
    updateData.acceptedAt = now;
  }

  await prisma.offer.update({
    where: { id: parsed.data.id },
    data: updateData,
  });

  await logActivity({
    userId: user.id,
    entityType: "OFFER",
    entityId: parsed.data.id,
    action: "OFFER_STATUS_UPDATED",
    diff: { status: parsed.data.status },
  });

  revalidateOfferPaths();
}

export async function archiveOffer(formData: FormData) {
  const user = await requirePermission("OFFERS", "DELETE");
  const id = formData.get("id");
  if (!id || typeof id !== "string") return;

  const offer = await prisma.offer.findUnique({
    where: { id, deletedAt: null },
    select: { status: true },
  });
  if (!offer) return;

  await prisma.offer.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  await logActivity({
    userId: user.id,
    entityType: "OFFER",
    entityId: id,
    action: "OFFER_ARCHIVED",
    diff: { previousStatus: offer.status },
  });

  revalidateOfferPaths();
}

export async function convertOfferToProject(formData: FormData) {
  const user = await requirePermission("PROJECTS", "CREATE");
  const id = formData.get("id");
  if (!id || typeof id !== "string") return;

  const offer = await prisma.offer.findUnique({
    where: { id, deletedAt: null },
    include: { items: true, client: true },
  });
  if (!offer) return;
  if (offer.status !== OfferStatus.ACCEPTED) return;
  if (offer.projectId) return;

  // Find next project code
  const year = new Date().getFullYear();
  const prefix = `ELT-${year}-`;
  const existingCodes = await prisma.project.findMany({
    where: { code: { startsWith: prefix } },
    select: { code: true },
  });
  let maxSeq = 0;
  for (const item of existingCodes) {
    const seq = Number(item.code.slice(prefix.length));
    if (Number.isInteger(seq) && seq > maxSeq) maxSeq = seq;
  }
  const code = `${prefix}${String(maxSeq + 1).padStart(3, "0")}`;

  await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        code,
        title: offer.title,
        description: offer.description,
        type: ProjectType.INDUSTRIAL,
        status: "PLANNED" as ProjectStatus,
        siteAddress: offer.client?.billingAddress || "",
        contractValue: offer.totalAmount,
        estimatedBudget: offer.totalAmount,
        clientId: offer.clientId,
        managerId: user.id,
        startDate: new Date(),
      },
    });
    await tx.offer.update({
      where: { id: offer.id },
      data: { projectId: project.id, status: OfferStatus.ACCEPTED },
    });
  });

  await logActivity({
    userId: user.id,
    entityType: "OFFER",
    entityId: offer.id,
    action: "OFFER_CONVERTED_TO_PROJECT",
    diff: { projectCode: code },
  });

  revalidatePath("/proiecte");
  revalidateOfferPaths();
}
