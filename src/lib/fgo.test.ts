import { FgoInvoiceStatus } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { uploadInvoiceToFgo } from "./fgo";

describe("FGO sandbox upload", () => {
  it("returns a Prisma-compatible status enum", async () => {
    const previousEnabled = process.env.EFATURA_ENABLED;
    const previousEnv = process.env.FGO_ENV;
    process.env.EFATURA_ENABLED = "true";
    process.env.FGO_ENV = "sandbox";

    try {
      const result = await uploadInvoiceToFgo("{}");

      expect(result.ok).toBe(true);
      expect(result.trackingId).toMatch(/^SANDBOX-/);
      expect(result.status).toBe(FgoInvoiceStatus.SUBMITTED_OK);
    } finally {
      process.env.EFATURA_ENABLED = previousEnabled;
      process.env.FGO_ENV = previousEnv;
    }
  });
});
