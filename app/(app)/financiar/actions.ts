"use server";

import { CostType, InvoiceStatus, NotificationType, Prisma, RoleKey } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertProjectAccess } from "@/src/lib/access-scope";
import { logActivity } from "@/src/lib/activity-log";
import { ActionState, fromZodError } from "@/src/lib/action-state";
import { notifyRoles } from "@/src/lib/notifications";
import { requirePermission } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";
import { buildInvoiceStatusUpdateData } from "@/src/lib/financiar-invoice-status";

const costSchema = z.object({
  projectId: z.string().cuid(),
  type: z.nativeEnum(CostType),
  description: z.string().trim().min(2),
  amount: z.coerce.number().positive(),
  occurredAt: z.coerce.date(),
});

const updateInvoiceStatusSchema = z.object({
  id: z.string().cuid(),
  status: z.nativeEnum(InvoiceStatus),
});

const deleteInvoiceSchema = z.object({
  id: z.string().cuid(),
});

const deleteCostEntrySchema = z.object({
  id: z.string().cuid(),
});

async function createCostEntryInternal(formData: FormData) {
  const currentUser = await requirePermission("INVOICES", "CREATE");

  const parsed = costSchema.safeParse({
    projectId: formData.get("projectId"),
    type: formData.get("type"),
    description: formData.get("description"),
    amount: formData.get("amount"),
    occurredAt: formData.get("occurredAt"),
  });

  if (!parsed.success) throw parsed.error;
  await assertProjectAccess(currentUser, parsed.data.projectId);

  const entry = await prisma.costEntry.create({
    data: {
      projectId: parsed.data.projectId,
      type: parsed.data.type,
      description: parsed.data.description,
      amount: parsed.data.amount,
      occurredAt: parsed.data.occurredAt,
      approvedById: currentUser.id,
    },
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "COST_ENTRY",
    entityId: entry.id,
    action: "COST_ENTRY_CREATED",
  });

  revalidatePath("/financiar");
  revalidatePath("/panou");
}

export async function createCostEntryAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    await createCostEntryInternal(formData);
    return { ok: true, message: "Costul operational a fost adaugat." };
  } catch (error) {
    if (error instanceof z.ZodError) return fromZodError(error);
    return { ok: false, message: error instanceof Error ? error.message : "Eroare la salvare cost" };
  }
}

export async function updateInvoiceStatus(formData: FormData) {
  const currentUser = await requirePermission("INVOICES", "UPDATE");
  const parsed = updateInvoiceStatusSchema.safeParse({
    id: formData.get("id"),
    status: formData.get("status"),
  });
  if (!parsed.success) throw new Error("Status factura invalid");
  const { id, status } = parsed.data;

  const current = await prisma.invoice.findUnique({
    where: { id },
    select: { projectId: true, totalAmount: true, status: true },
  });
  if (!current) throw new Error("Factura inexistenta.");
  await assertProjectAccess(currentUser, current.projectId);

  const updateData = buildInvoiceStatusUpdateData(current.status, status, current.totalAmount);
  if (!updateData) {
    return;
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: updateData,
  });

  await logActivity({
    userId: currentUser.id,
    entityType: "INVOICE",
    entityId: updated.id,
    action: "INVOICE_STATUS_UPDATED",
    diff: { status },
  });

  if (status === InvoiceStatus.OVERDUE) {
    await notifyRoles({
      roleKeys: [RoleKey.ACCOUNTANT, RoleKey.PROJECT_MANAGER, RoleKey.ADMINISTRATOR],
      type: NotificationType.INVOICE_OVERDUE,
      title: "Factura restanta",
      message: `Factura ${updated.invoiceNumber} este restanta.`,
      actionUrl: "/financiar",
    });
  }

  revalidatePath("/financiar");
  revalidatePath("/proiecte");
  revalidatePath("/panou");
}

export async function deleteInvoice(formData: FormData) {
  const currentUser = await requirePermission("INVOICES", "DELETE");
  const parsed = deleteInvoiceSchema.safeParse({
    id: formData.get("id"),
  });
  if (!parsed.success) {
    throw new Error("Factura selectata este invalida.");
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: parsed.data.id },
    select: {
      id: true,
      projectId: true,
      invoiceNumber: true,
      status: true,
      totalAmount: true,
    },
  });
  if (!invoice) {
    throw new Error("Factura nu exista sau a fost deja stearsa.");
  }
  await assertProjectAccess(currentUser, invoice.projectId);

  try {
    await prisma.invoice.delete({
      where: { id: invoice.id },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      throw new Error("Factura nu poate fi stearsa deoarece este legata de alte inregistrari.");
    }
    throw error;
  }

  await logActivity({
    userId: currentUser.id,
    entityType: "INVOICE",
    entityId: invoice.id,
    action: "INVOICE_DELETED",
    diff: {
      invoiceNumber: invoice.invoiceNumber,
      status: invoice.status,
      totalAmount: invoice.totalAmount.toString(),
    },
  });

  revalidatePath("/financiar");
  revalidatePath("/proiecte");
  revalidatePath("/panou");
}

export async function deleteCostEntry(formData: FormData) {
  const currentUser = await requirePermission("INVOICES", "DELETE");
  const parsed = deleteCostEntrySchema.safeParse({
    id: formData.get("id"),
  });
  if (!parsed.success) {
    throw new Error("Costul selectat este invalid.");
  }

  const costEntry = await prisma.costEntry.findUnique({
    where: { id: parsed.data.id },
    select: {
      id: true,
      projectId: true,
      type: true,
      description: true,
      amount: true,
      occurredAt: true,
    },
  });
  if (!costEntry) {
    throw new Error("Costul nu exista sau a fost deja sters.");
  }
  await assertProjectAccess(currentUser, costEntry.projectId);

  try {
    await prisma.costEntry.delete({
      where: { id: costEntry.id },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      throw new Error("Costul nu poate fi sters deoarece este legat de alte inregistrari.");
    }
    throw error;
  }

  await logActivity({
    userId: currentUser.id,
    entityType: "COST_ENTRY",
    entityId: costEntry.id,
    action: "COST_ENTRY_DELETED",
    diff: {
      type: costEntry.type,
      description: costEntry.description,
      amount: costEntry.amount.toString(),
      occurredAt: costEntry.occurredAt.toISOString(),
    },
  });

  revalidatePath("/financiar");
  revalidatePath("/proiecte");
  revalidatePath("/panou");
}
