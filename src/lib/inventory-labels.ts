import {
  InventoryAssignmentStatus,
  InventoryCondition,
  InventoryInspectionResult,
  InventoryInspectionType,
  InventoryItemStatus,
  InventoryItemType,
} from "@prisma/client";

export const inventoryItemStatusLabels: Record<InventoryItemStatus, string> = {
  AVAILABLE: "Disponibil",
  ASSIGNED: "Alocat",
  RESERVED: "Rezervat",
  IN_SERVICE: "In mentenanta",
  DAMAGED: "Deteriorat",
  LOST: "Pierdut",
  RETIRED: "Scos din uz",
};

export const inventoryItemTypeLabels: Record<InventoryItemType, string> = {
  TOOL: "Scula",
  EQUIPMENT: "Echipament",
  CONSUMABLE: "Consumabil",
  STOCK_ITEM: "Articol stoc",
};

export const inventoryAssignmentStatusLabels: Record<InventoryAssignmentStatus, string> = {
  ACTIVE: "Activ",
  RETURNED: "Returnat",
  PARTIAL_RETURNED: "Retur partial",
  LOST: "Pierdut",
};

export const inventoryConditionLabels: Record<InventoryCondition, string> = {
  NEW: "Nou",
  GOOD: "Buna",
  USED: "Utilizat",
  DAMAGED: "Deteriorat",
  LOST: "Pierdut",
};

export const inventoryInspectionTypeLabels: Record<InventoryInspectionType, string> = {
  INSPECTION: "Inspectie",
  CALIBRATION: "Calibrare",
  WARRANTY_CHECK: "Verificare garantie",
  EXPIRY_CHECK: "Verificare expirare",
};

export const inventoryInspectionResultLabels: Record<InventoryInspectionResult, string> = {
  PASS: "Conform",
  NEEDS_SERVICE: "Necesita service",
  FAILED: "Neconform",
};
