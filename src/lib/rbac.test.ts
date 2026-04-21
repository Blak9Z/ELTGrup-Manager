import { describe, expect, it } from "vitest";
import { hasPermission, isRoleKey, normalizeRoleKeys } from "./rbac";

describe("normalizeRoleKeys", () => {
  it("keeps valid role keys and strips invalid ones", () => {
    const result = normalizeRoleKeys([" SUPER_ADMIN ", "INVALID_ROLE", "WORKER"]);
    expect(result).toEqual(["SUPER_ADMIN", "WORKER"]);
  });

  it("deduplicates repeated role keys", () => {
    const result = normalizeRoleKeys(["WORKER", "WORKER", " WORKER "]);
    expect(result).toEqual(["WORKER"]);
  });
});

describe("isRoleKey", () => {
  it("detects valid and invalid role key values", () => {
    expect(isRoleKey("WORKER")).toBe(true);
    expect(isRoleKey("worker")).toBe(false);
  });
});

describe("hasPermission", () => {
  it("grants access for valid mapped role", () => {
    expect(hasPermission(["PROJECT_MANAGER"], "PROJECTS", "VIEW")).toBe(true);
  });

  it("denies access for invalid roles", () => {
    expect(hasPermission(["INVALID_ROLE"], "PROJECTS", "VIEW")).toBe(false);
  });

  it("prevents privilege escalation for worker on settings", () => {
    expect(hasPermission(["WORKER"], "SETTINGS", "MANAGE")).toBe(false);
  });

  it("denies destructive actions for project manager where not allowed", () => {
    expect(hasPermission(["PROJECT_MANAGER"], "PROJECTS", "DELETE")).toBe(false);
  });

  it("always grants super admin regardless of additional invalid role strings", () => {
    expect(hasPermission(["SUPER_ADMIN", "bad-role"], "USERS", "DELETE")).toBe(true);
  });
});
