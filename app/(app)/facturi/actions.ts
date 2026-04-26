"use server";

import { FgoInvoiceStatus } from "@prisma/client";
import { requirePermission } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";
import { uploadInvoiceToFgo } from "@/src/lib/fgo";
import { toFgoInvoiceStatus } from "@/src/lib/fgo-status";
import { logActivity } from "@/src/lib/activity-log";
import { revalidatePath } from "next/cache";

export async function sendInvoiceToFgo(formData: FormData) {
  const user = await requirePermission("INVOICES", "UPDATE");
  const invoiceId = formData.get("invoiceId") as string;
  const projectId = formData.get("projectId") as string;
  if (!invoiceId) return { ok: false, message: "ID factura lipsa" };

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      project: { select: { code: true, title: true, clientId: true } },
      client: { select: { name: true, vatCode: true, registrationNumber: true } },
    },
  });

  if (!invoice) return { ok: false, message: "Factura negasita" };

  // Genereaza JSON factura (simplificat / dummy pentru demo)
  const payload = JSON.stringify({
    invoiceNumber: invoice.invoiceNumber,
    issueDate: invoice.issueDate.toISOString(),
    totalAmount: Number(invoice.totalAmount),
    clientName: invoice.client.name,
    clientVat: (invoice.client as any).vatNumber || invoice.client.vatCode,
    projectCode: invoice.project.code,
  });

  const result = await uploadInvoiceToFgo(payload);

  if (result.ok && result.trackingId) {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        fgoTrackingId: result.trackingId,
        fgoStatus: result.status as FgoInvoiceStatus,
        fgoSentAt: new Date(),
      },
    });
  } else {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        fgoStatus: toFgoInvoiceStatus(result.status as string),
        fgoErrorCode: result.errors?.[0]?.code || "UNKNOWN",
      },
    });
  }

  await logActivity({
    userId: user.id,
    entityType: "INVOICE",
    entityId: invoiceId,
    action: result.ok ? "INVOICE_SENT_FGO" : "INVOICE_FGO_ERROR",
    diff: { trackingId: result.trackingId, status: result.status, errors: result.errors },
  });

  revalidatePath(projectId ? `/proiecte/${projectId}` : "/facturi");

  return { ok: result.ok, trackingId: result.trackingId, status: result.status, errors: result.errors };
}
