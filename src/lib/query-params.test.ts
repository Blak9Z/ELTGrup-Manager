import { describe, expect, it } from "vitest";
import { buildListHref, parsePositiveIntParam, resolvePagination } from "./query-params";

describe("resolvePagination", () => {
  it("keeps at least one page when total is zero", () => {
    expect(resolvePagination({ page: 1, totalItems: 0, pageSize: 20 })).toEqual({
      totalPages: 1,
      currentPage: 1,
      skip: 0,
      take: 20,
    });
  });

  it("keeps the requested page when it is in range", () => {
    expect(resolvePagination({ page: 3, totalItems: 95, pageSize: 20 })).toEqual({
      totalPages: 5,
      currentPage: 3,
      skip: 40,
      take: 20,
    });
  });

  it("clamps the page when requested page is above total pages", () => {
    expect(resolvePagination({ page: 9, totalItems: 41, pageSize: 20 })).toEqual({
      totalPages: 3,
      currentPage: 3,
      skip: 40,
      take: 20,
    });
  });

  it("works with parsed fallback page values", () => {
    const parsedPage = parsePositiveIntParam("abc", { fallback: 1 });
    expect(parsedPage).toBe(1);

    expect(resolvePagination({ page: parsedPage, totalItems: 50, pageSize: 20 })).toEqual({
      totalPages: 3,
      currentPage: 1,
      skip: 0,
      take: 20,
    });
  });

  it("computes skip from current page and page size", () => {
    const meta = resolvePagination({ page: 3, totalItems: 45, pageSize: 20 });
    expect(meta.currentPage).toBe(3);
    expect(meta.skip).toBe(40);
  });
});

describe("buildListHref", () => {
  it("builds href and omits page=1", () => {
    const href = buildListHref("/materiale", {
      page: 1,
      q: "cabluri",
      status: "PENDING",
    });

    expect(href).toBe("/materiale?q=cabluri&status=PENDING");
  });

  it("omits empty values and returns base path when no params remain", () => {
    const href = buildListHref("/financiar", {
      page: 1,
      status: "",
      projectId: undefined,
      q: "   ",
    });

    expect(href).toBe("/financiar");
  });
});
