"use server";

import { revalidatePath } from "next/cache";
import { ClientType } from "@prisma/client";
import { z } from "zod";
import { logActivity } from "@/src/lib/activity-log";
import { ActionState, fromZodError } from "@/src/lib/action-state";
import { assertClientAccess, resolveAccessScope } from "@/src/lib/access-scope";
import { requirePermission } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";

const clientSchema = z.object({
  name: z.string().trim().min(2),
  type: z.nativeEnum(ClientType),
  cui: z.string().trim().optional(),
  email: z.email().optional().or(z.literal("")),
  phone: z.string().trim().optional(),
  billingAddress: z.string().trim().optional(),
  contactName: z.string().trim().optional(),
  contactEmail: z.email().optional().or(z.literal("")),
  contactPhone: z.string().trim().optional(),
});

const addClientNoteSchema = z.object({
  id: z.string().cuid(),
  note: z.string().trim().min(1).max(2000),
});

const archiveClientSchema = z.object({
  id: z.string().cuid(),
});

const bulkArchiveClientsSchema = z.object({
  ids: z.array(z.string().cuid()).min(1),
});

function revalidateClientRelatedPaths(clientId?: string) {
  revalidatePath("/clienti");
  revalidatePath("/proiecte");
  if (clientId) revalidatePath(`/clienti/${clientId}`);
}

async function createClientInternal(formData: FormData) {
  const currentUser = await requirePermission("PROJECTS", "CREATE");

  const parsed = clientSchema.safeParse({
    name: formData.get("name"),
    type: formData.get("type") || ClientType.COMPANY,
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

  revalidateClientRelatedPaths(created.id);
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

  const parsed = addClientNoteSchema.safeParse({
    id: formData.get("id"),
    note: formData.get("note"),
  });
  if (!parsed.success) throw new Error("Nota este obligatorie");
  const { id, note } = parsed.data;
  await assertClientAccess(currentUser, id);

  const affectedRows = await prisma.$executeRaw`
    UPDATE "Client"
    SET "notes" = CASE
      WHEN "notes" IS NULL OR "notes" = '' THEN ${note}
      ELSE "notes" || E'\n' || ${note}
    END
    WHERE id = ${id}
  `;

  if (affectedRows === 0) {
    throw new Error("Clientul nu a fost gasit.");
  }

  await logActivity({
    userId: currentUser.id,
    entityType: "CLIENT",
    entityId: id,
    action: "CLIENT_NOTE_ADDED",
    diff: { note },
  });

  revalidateClientRelatedPaths(id);
}

export async function archiveClient(formData: FormData) {
  const currentUser = await requirePermission("PROJECTS", "DELETE");
  const parsed = archiveClientSchema.safeParse({
    id: formData.get("id"),
  });

  if (!parsed.success) throw new Error("Client invalid pentru arhivare.");
  await assertClientAccess(currentUser, parsed.data.id);

  const existingClient = await prisma.client.findUnique({
    where: { id: parsed.data.id },
    select: { id: true, name: true, deletedAt: true },
  });
  if (!existingClient || existingClient.deletedAt) {
    throw new Error("Client inexistent sau deja arhivat.");
  }

  await prisma.client.update({
    where: { id: parsed.data.id },
    data: { deletedAt: new Date() },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "CLIENT",
    entityId: parsed.data.id,
    action: "CLIENT_SOFT_DELETED",
    diff: { name: existingClient.name },
  });

  revalidateClientRelatedPaths(parsed.data.id);
}

export async function bulkArchiveClientsAction(formData: FormData) {
  const currentUser = await requirePermission("PROJECTS", "DELETE");
  const parsed = bulkArchiveClientsSchema.safeParse({
    ids: formData.getAll("ids").map(String).filter(Boolean),
  });
  if (!parsed.success) throw new Error("Selectie invalida pentru arhivarea clientilor.");

  const scope = await resolveAccessScope(currentUser);
  let scopedIds = parsed.data.ids;

  if (scope.projectIds !== null) {
    const allowedIds = new Set(
      (
        await prisma.client.findMany({
          where: {
            id: { in: parsed.data.ids },
            deletedAt: null,
            projects: {
              some: {
                id: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] },
              },
            },
          },
          select: { id: true },
        })
      ).map((client) => client.id),
    );

    scopedIds = parsed.data.ids.filter((id) => allowedIds.has(id));
  }

  if (scopedIds.length === 0) {
    throw new Error("Nu ai acces la clientii selectati.");
  }

  const result = await prisma.client.updateMany({
    where: { id: { in: scopedIds }, deletedAt: null },
    data: { deletedAt: new Date() },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "CLIENT_BULK",
    entityId: "MULTI",
    action: "CLIENTS_ARCHIVED_BULK",
    diff: {
      ids: scopedIds,
      affectedRows: result.count,
    },
  });

  revalidateClientRelatedPaths();
}
