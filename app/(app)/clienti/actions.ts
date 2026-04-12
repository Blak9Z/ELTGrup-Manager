"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/src/lib/activity-log";
import { ActionState, fromZodError } from "@/src/lib/action-state";
import { requirePermission } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";

const clientSchema = z.object({
  name: z.string().min(2),
  type: z.string().min(2),
  cui: z.string().optional(),
  email: z.email().optional().or(z.literal("")),
  phone: z.string().optional(),
  billingAddress: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.email().optional().or(z.literal("")),
  contactPhone: z.string().optional(),
});

async function createClientInternal(formData: FormData) {
  const currentUser = await requirePermission("PROJECTS", "CREATE");

  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type") || "COMPANY",
    cui: formData.get("cui") || undefined,
    email: formData.get("email") || undefined,
    phone: formData.get("phone") || undefined,
    billingAddress: formData.get("billingAddress") || undefined,
    contactName: formData.get("contactName") || undefined,
    contactEmail: formData.get("contactEmail") || undefined,
    contactPhone: formData.get("contactPhone") || undefined,
  });

  if (!parsed.success) throw parsed.error;

  const created = await prisma.client.create({
    data: {
      name: parsed.data.name,
      type: parsed.data.type,
      cui: parsed.data.cui,
      email: parsed.data.email || null,
      phone: parsed.data.phone,
      billingAddress: parsed.data.billingAddress,
      contacts: parsed.data.contactName
        ? {
            create: {
              fullName: parsed.data.contactName,
              email: parsed.data.contactEmail || null,
              phone: parsed.data.contactPhone,
              isPrimary: true,
            },
          }
        : undefined,
    },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "CLIENT",
    entityId: created.id,
    action: "CLIENT_CREATED",
    diff: { name: created.name },
  });

  revalidatePath("/clienti");
}

export async function createClientAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await createClientInternal(formData);
    return { ok: true, message: "Client creat cu succes." };
  } catch (error) {
    if (error instanceof z.ZodError) return fromZodError(error);
    return { ok: false, message: error instanceof Error ? error.message : "Eroare la creare client" };
  }
}

export async function addClientNote(formData: FormData) {
  const currentUser = await requirePermission("PROJECTS", "UPDATE");

  const id = String(formData.get("id"));
  const note = String(formData.get("note") || "").trim();
  if (!note) throw new Error("Nota este obligatorie");

  const client = await prisma.client.findUnique({ where: { id }, select: { notes: true } });
  await prisma.client.update({
    where: { id },
    data: {
      notes: [client?.notes, note].filter(Boolean).join("\n"),
    },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "CLIENT",
    entityId: id,
    action: "CLIENT_NOTE_ADDED",
    diff: { note },
  });

  revalidatePath("/clienti");
  revalidatePath(`/proiecte`);
}
