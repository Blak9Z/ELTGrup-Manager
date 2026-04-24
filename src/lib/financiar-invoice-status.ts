import { InvoiceStatus, Prisma } from "@prisma/client";

export const invoiceStatusLabels: Record<InvoiceStatus, string> = {
  [InvoiceStatus.DRAFT]: "draft",
  [InvoiceStatus.SENT]: "trimisa",
  [InvoiceStatus.PARTIAL_PAID]: "partial achitata",
  [InvoiceStatus.PAID]: "achitata",
  [InvoiceStatus.OVERDUE]: "restanta",
  [InvoiceStatus.CANCELED]: "anulata",
};

export const invoiceStatusTransitions: Record<InvoiceStatus, readonly InvoiceStatus[]> = {
  [InvoiceStatus.DRAFT]: [InvoiceStatus.SENT, InvoiceStatus.CANCELED],
  [InvoiceStatus.SENT]: [
    InvoiceStatus.PARTIAL_PAID,
    InvoiceStatus.PAID,
    InvoiceStatus.OVERDUE,
    InvoiceStatus.CANCELED,
  ],
  [InvoiceStatus.PARTIAL_PAID]: [InvoiceStatus.PAID, InvoiceStatus.OVERDUE, InvoiceStatus.CANCELED],
  [InvoiceStatus.PAID]: [],
  [InvoiceStatus.OVERDUE]: [InvoiceStatus.PARTIAL_PAID, InvoiceStatus.PAID, InvoiceStatus.CANCELED],
  [InvoiceStatus.CANCELED]: [],
};

export function isInvoiceStatusTransitionAllowed(currentStatus: InvoiceStatus, nextStatus: InvoiceStatus) {
  return currentStatus === nextStatus || invoiceStatusTransitions[currentStatus].includes(nextStatus);
}

export function getInvoiceStatusTransitionError(currentStatus: InvoiceStatus, nextStatus: InvoiceStatus) {
  return `Tranzitia de status a facturii este invalida: din statusul ${invoiceStatusLabels[currentStatus]} nu poti trece la ${invoiceStatusLabels[nextStatus]}.`;
}

export function buildInvoiceStatusUpdateData(
  currentStatus: InvoiceStatus,
  nextStatus: InvoiceStatus,
  totalAmount: Prisma.Decimal | number | string,
  now = new Date(),
) {
  if (!isInvoiceStatusTransitionAllowed(currentStatus, nextStatus)) {
    throw new Error(getInvoiceStatusTransitionError(currentStatus, nextStatus));
  }

  if (currentStatus === nextStatus) {
    return null;
  }

  if (nextStatus === InvoiceStatus.PAID) {
    return {
      status: nextStatus,
      paidAt: now,
      paidAmount: totalAmount,
    };
  }

  return { status: nextStatus };
}
