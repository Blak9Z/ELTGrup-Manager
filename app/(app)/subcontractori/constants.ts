export const SUBCONTRACTOR_APPROVAL_STATUSES = [
  "IN_VERIFICARE",
  "APROBAT",
  "RESPINS",
  "SUSPENDAT",
] as const;

export type SubcontractorApprovalStatus = (typeof SUBCONTRACTOR_APPROVAL_STATUSES)[number];
