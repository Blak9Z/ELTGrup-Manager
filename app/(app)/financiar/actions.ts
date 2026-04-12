"use server";

import { CostType, InvoiceStatus, NotificationType, RoleKey } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logActivity } from "@/src/lib/activity-log";
import { ActionState, fromZodError } from "@/src/lib/action-state";
import { notifyRoles } from "@/src/lib/notifications";
import { requirePermission } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";

const costSchema = z.object({
  projectId: z.string().cuid(),
  type: z.nativeEnum(CostType),
  description: z.string().min(2),
  amount: z.coerce.number().positive(),
  occurredAt: z.string().min(1),
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

  const entry = await prisma.costEntry.create({
    data: {
      projectId: parsed.data.projectId,
      type: parsed.data.type,
      description: parsed.data.description,
      amount: parsed.data.amount,
      occurredAt: new Date(parsed.data.occurredAt),
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
  const id = String(formData.get("id"));
  const status = String(formData.get("status"));

  if (!Object.values(InvoiceStatus).includes(status as InvoiceStatus)) {
    throw new Error("Status factura invalid");
  }

  const updated = await prisma.invoice.update({
    where: { id },
    data: {
      status: status as InvoiceStatus,
      paidAt: status === InvoiceStatus.PAID ? new Date() : null,
    },
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
  revalidatePath("/panou");
}
