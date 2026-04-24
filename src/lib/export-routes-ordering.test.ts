import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockAuth,
  mockHasPermission,
  mockResolveAccessScope,
  mockTimeEntryScopeWhere,
  mockToCsv,
  mockPrisma,
} = vi.hoisted(() => ({
  mockAuth: vi.fn(),
  mockHasPermission: vi.fn(),
  mockResolveAccessScope: vi.fn(),
  mockTimeEntryScopeWhere: vi.fn(),
  mockToCsv: vi.fn(),
  mockPrisma: {
    timeEntry: { findMany: vi.fn() },
    invoice: { findMany: vi.fn() },
    material: { findMany: vi.fn() },
    dailySiteReport: { findMany: vi.fn() },
  },
}));

vi.mock("@/src/lib/auth", () => ({
  auth: mockAuth,
}));

vi.mock("@/src/lib/rbac", () => ({
  hasPermission: mockHasPermission,
}));

vi.mock("@/src/lib/access-scope", () => ({
  resolveAccessScope: mockResolveAccessScope,
  timeEntryScopeWhere: mockTimeEntryScopeWhere,
}));

vi.mock("@/src/lib/csv", () => ({
  toCsv: mockToCsv,
}));

vi.mock("@/src/lib/prisma", () => ({
  prisma: mockPrisma,
}));

describe("export route ordering", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockAuth.mockResolvedValue({
      user: {
        id: "user-1",
        email: "test@example.com",
        roleKeys: ["ADMINISTRATOR"],
      },
    });
    mockHasPermission.mockReturnValue(true);
    mockResolveAccessScope.mockResolvedValue({ projectIds: null, teamId: null });
    mockTimeEntryScopeWhere.mockReturnValue({});
    mockToCsv.mockReturnValue("csv");

    mockPrisma.timeEntry.findMany.mockResolvedValue([
      {
        id: "time-1",
        startAt: new Date("2026-01-10T08:00:00.000Z"),
        user: { firstName: "Ion", lastName: "Pop" },
        project: { title: "Proiect A" },
        workOrder: null,
        durationMinutes: 60,
        breakMinutes: 0,
        overtimeMinutes: 0,
        status: "APPROVED",
      },
    ]);
    mockPrisma.invoice.findMany.mockResolvedValue([
      {
        id: "inv-1",
        invoiceNumber: "INV-001",
        project: { title: "Proiect A" },
        client: { name: "Client A" },
        totalAmount: 1000,
        paidAmount: 300,
        status: "SENT",
        dueDate: new Date("2026-02-05T00:00:00.000Z"),
      },
    ]);
    mockPrisma.material.findMany.mockResolvedValue([
      {
        id: "mat-1",
        code: "MAT-001",
        name: "Cablu",
        unitOfMeasure: "m",
        internalCost: 10,
        minStockLevel: 5,
        stockMovements: [
          { type: "IN", quantity: 25 },
          { type: "OUT", quantity: 4 },
        ],
      },
    ]);
    mockPrisma.dailySiteReport.findMany.mockResolvedValue([
      {
        id: "rep-1",
        reportDate: new Date("2026-01-11T00:00:00.000Z"),
        project: { title: "Proiect A" },
        weather: null,
        workersCount: 7,
        blockers: null,
        safetyIncidents: null,
        createdBy: { firstName: "Maria", lastName: "Ionescu" },
      },
    ]);
  });

  it("uses deterministic order for pontaj export", async () => {
    const { GET: getPontajExport } = await import("../../app/api/export/pontaj/route");
    const request = new Request("http://localhost/api/export/pontaj?month=1&year=2026");
    await getPontajExport(request);

    expect(mockPrisma.timeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ startAt: "asc" }, { id: "asc" }],
      }),
    );
  });

  it("uses deterministic order for financiar export", async () => {
    const { GET: getFinanciarExport } = await import("../../app/api/export/financiar/route");
    await getFinanciarExport();

    expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ dueDate: "asc" }, { id: "asc" }],
      }),
    );
  });

  it("uses deterministic order for materiale export", async () => {
    const { GET: getMaterialeExport } = await import("../../app/api/export/materiale/route");
    await getMaterialeExport();

    expect(mockPrisma.material.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ name: "asc" }, { id: "asc" }],
      }),
    );
  });

  it("uses deterministic order for rapoarte export", async () => {
    const { GET: getRapoarteExport } = await import("../../app/api/export/rapoarte/route");
    await getRapoarteExport();

    expect(mockPrisma.dailySiteReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ reportDate: "desc" }, { id: "asc" }],
      }),
    );
  });
});
