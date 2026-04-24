import { InvoiceStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  buildInvoiceStatusUpdateData,
  getInvoiceStatusTransitionError,
  isInvoiceStatusTransitionAllowed,
} from "./financiar-invoice-status";

describe("invoice status transitions", () => {
  it("allows expected workflow transitions", () => {
    expect(isInvoiceStatusTransitionAllowed(InvoiceStatus.DRAFT, InvoiceStatus.SENT)).toBe(true);
    expect(isInvoiceStatusTransitionAllowed(InvoiceStatus.SENT, InvoiceStatus.PAID)).toBe(true);
    expect(isInvoiceStatusTransitionAllowed(InvoiceStatus.OVERDUE, InvoiceStatus.CANCELED)).toBe(true);
  });

  it("rejects invalid backward or terminal transitions", () => {
    expect(isInvoiceStatusTransitionAllowed(InvoiceStatus.DRAFT, InvoiceStatus.PAID)).toBe(false);
    expect(isInvoiceStatusTransitionAllowed(InvoiceStatus.PAID, InvoiceStatus.SENT)).toBe(false);
    expect(isInvoiceStatusTransitionAllowed(InvoiceStatus.CANCELED, InvoiceStatus.SENT)).toBe(false);
  });

  it("returns clear Romanian error for invalid transition", () => {
    expect(getInvoiceStatusTransitionError(InvoiceStatus.DRAFT, InvoiceStatus.PAID)).toContain(
      "Tranzitia de status a facturii este invalida",
    );
  });

  it("sets paid fields only when invoice becomes PAID", () => {
    const now = new Date("2026-04-24T10:00:00.000Z");

    const paidUpdate = buildInvoiceStatusUpdateData(InvoiceStatus.SENT, InvoiceStatus.PAID, "21420.00", now);
    expect(paidUpdate).toEqual({
      status: InvoiceStatus.PAID,
      paidAt: now,
      paidAmount: "21420.00",
    });

    const noOp = buildInvoiceStatusUpdateData(InvoiceStatus.PAID, InvoiceStatus.PAID, "21420.00", now);
    expect(noOp).toBeNull();

    const overdueUpdate = buildInvoiceStatusUpdateData(InvoiceStatus.SENT, InvoiceStatus.OVERDUE, "21420.00", now);
    expect(overdueUpdate).toEqual({ status: InvoiceStatus.OVERDUE });
  });
});
