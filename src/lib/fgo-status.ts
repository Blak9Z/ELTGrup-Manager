import { FgoInvoiceStatus } from "@prisma/client";

export function toFgoInvoiceStatus(status: string): FgoInvoiceStatus {
  switch (status) {
    case "DRAFT_UPLOADED": return "DRAFT_UPLOADED" as unknown as FgoInvoiceStatus;
    case "PENDING_VALIDATION": return "PENDING_VALIDATION" as unknown as FgoInvoiceStatus;
    case "VALIDATION_OK": return "VALIDATION_OK" as unknown as FgoInvoiceStatus;
    case "VALIDATION_ERRORS": return "VALIDATION_ERRORS" as unknown as FgoInvoiceStatus;
    case "SENT_TO_ANAF": return "SENT_TO_ANAF" as unknown as FgoInvoiceStatus;
    case "SIGNED": return "SIGNED" as unknown as FgoInvoiceStatus;
    case "SUBMITTED_OK": return "SUBMITTED_OK" as unknown as FgoInvoiceStatus;
    case "SUBMITTED_ERRORS": return "SUBMITTED_ERRORS" as unknown as FgoInvoiceStatus;
    case "REJECTED": return "REJECTED" as unknown as FgoInvoiceStatus;
    default: return "DRAFT_UPLOADED" as unknown as FgoInvoiceStatus;
  }
}
