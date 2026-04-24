import { describe, expect, it } from "vitest";
import {
  appModules,
  canAccessModule,
  canAccessPath,
  getDefaultModulePath,
  getModuleForPath,
  getVisibleModules,
  modulePolicies,
} from "./access-control";
import { navItems } from "../components/layout/navigation-config";
import { RoleKey } from "@prisma/client";

describe("module visibility", () => {
  it("denies settings module for non-admin roles", () => {
    expect(canAccessModule({ roleKeys: ["PROJECT_MANAGER"] }, "settings")).toBe(false);
  });

  it("does not allow users with invalid roles", () => {
    expect(canAccessModule({ roleKeys: ["INVALID_ROLE"] }, "notifications")).toBe(false);
  });

  it("keeps navigation modules and access modules aligned", () => {
    const navModuleSet = new Set(navItems.map((item) => item.module));
    expect(new Set(appModules)).toEqual(navModuleSet);
  });

  it("keeps financial module role allowlist aligned with invoice restrictions", () => {
    expect(modulePolicies.financial.roles).not.toContain(RoleKey.BACKOFFICE);
  });
});

describe("path resolution and route protection", () => {
  it("maps route aliases to the right module", () => {
    expect(getModuleForPath("/echipamente")).toBe("materials");
    expect(getModuleForPath("/notificari/")).toBe("notifications");
  });

  it("denies unknown non-api app routes by default", () => {
    expect(canAccessPath({ roleKeys: ["ADMINISTRATOR"] }, "/admin-shadow")).toBe(false);
  });

  it("enforces export permissions on protected api routes", () => {
    expect(canAccessPath({ roleKeys: ["WORKER"] }, "/api/export/materiale")).toBe(false);
    expect(canAccessPath({ roleKeys: ["ACCOUNTANT"] }, "/api/export/pontaj")).toBe(true);
  });
});

describe("default route", () => {
  it("returns first visible module path for authorized users", () => {
    expect(getDefaultModulePath({ roleKeys: ["WORKER"] })).toBe("/panou");
  });

  it("falls back to login when no modules are visible", () => {
    expect(getDefaultModulePath({ roleKeys: ["INVALID_ROLE"] })).toBe("/autentificare");
  });

  it("returns modules users can access", () => {
    const modules = getVisibleModules({ roleKeys: ["WORKER"] });
    expect(modules).toContain("notifications");
    expect(modules).not.toContain("settings");
  });
});
