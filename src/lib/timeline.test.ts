import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildProjectTimeline, buildWorkOrderTimeline } from "./timeline";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    activityLog: { findMany: vi.fn() },
    workOrder: { findMany: vi.fn() },
    dailySiteReport: { findMany: vi.fn() },
    document: { findMany: vi.fn() },
    materialRequest: { findMany: vi.fn() },
    costEntry: { findMany: vi.fn() },
    invoice: { findMany: vi.fn() },
    comment: { findMany: vi.fn() },
    timeEntry: { findMany: vi.fn() },
  },
}));

vi.mock("@/src/lib/prisma", () => ({
  prisma: mockPrisma,
}));

describe("timeline ordering", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.activityLog.findMany.mockResolvedValue([]);
    mockPrisma.workOrder.findMany.mockResolvedValue([]);
    mockPrisma.dailySiteReport.findMany.mockResolvedValue([]);
    mockPrisma.document.findMany.mockResolvedValue([]);
    mockPrisma.materialRequest.findMany.mockResolvedValue([]);
    mockPrisma.costEntry.findMany.mockResolvedValue([]);
    mockPrisma.invoice.findMany.mockResolvedValue([]);
    mockPrisma.comment.findMany.mockResolvedValue([]);
    mockPrisma.timeEntry.findMany.mockResolvedValue([]);
  });

  it("uses deterministic orderBy clauses for project timeline sources", async () => {
    await buildProjectTimeline("project-1", 40);

    expect(mockPrisma.activityLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      }),
    );
    expect(mockPrisma.workOrder.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      }),
    );
    expect(mockPrisma.dailySiteReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      }),
    );
    expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      }),
    );
    expect(mockPrisma.materialRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      }),
    );
    expect(mockPrisma.costEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ occurredAt: "desc" }, { id: "asc" }],
      }),
    );
    expect(mockPrisma.invoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ issueDate: "desc" }, { id: "asc" }],
      }),
    );
  });

  it("uses deterministic orderBy clauses for work-order timeline sources", async () => {
    await buildWorkOrderTimeline("work-order-1", 40);

    expect(mockPrisma.activityLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      }),
    );
    expect(mockPrisma.comment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      }),
    );
    expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      }),
    );
    expect(mockPrisma.timeEntry.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ startAt: "desc" }, { id: "asc" }],
      }),
    );
    expect(mockPrisma.dailySiteReport.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      }),
    );
  });

  it("keeps stable order for equal timestamps in timeline output", async () => {
    const sharedDate = new Date("2026-01-02T10:00:00.000Z");
    mockPrisma.document.findMany.mockResolvedValue([
      { id: "a", title: "Doc A", category: "OTHER", fileName: "a.pdf", createdAt: sharedDate },
      { id: "b", title: "Doc B", category: "OTHER", fileName: "b.pdf", createdAt: sharedDate },
    ]);

    const events = await buildWorkOrderTimeline("work-order-2", 40);
    const documentEventIds = events.filter((event) => event.id.startsWith("doc-")).map((event) => event.id);

    expect(documentEventIds).toEqual(["doc-a", "doc-b"]);
  });
});
