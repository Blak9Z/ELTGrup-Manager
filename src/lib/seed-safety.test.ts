import { describe, expect, it } from "vitest";
import { evaluateDemoSeedEnvironment } from "./seed-safety";

describe("evaluateDemoSeedEnvironment", () => {
  it("allows demo mode in development when deploy env is unset", () => {
    const result = evaluateDemoSeedEnvironment({
      nodeEnv: "development",
    });

    expect(result.allowed).toBe(true);
    expect(result.nodeEnv).toBe("development");
    expect(result.deployEnvs).toEqual([]);
  });

  it("allows demo mode in test with local deploy env", () => {
    const result = evaluateDemoSeedEnvironment({
      nodeEnv: "test",
      appEnv: "local",
    });

    expect(result.allowed).toBe(true);
    expect(result.deployEnvs).toEqual(["local"]);
  });

  it("blocks demo mode when NODE_ENV is unset", () => {
    const result = evaluateDemoSeedEnvironment({
      nodeEnv: undefined,
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("NODE_ENV must be development or test");
  });

  it("blocks demo mode when NODE_ENV is production", () => {
    const result = evaluateDemoSeedEnvironment({
      nodeEnv: "production",
    });

    expect(result.allowed).toBe(false);
  });

  it("blocks demo mode for preview deploy env", () => {
    const result = evaluateDemoSeedEnvironment({
      nodeEnv: "development",
      vercelEnv: "preview",
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("preview");
  });

  it("blocks demo mode for unknown non-empty deploy env values", () => {
    const result = evaluateDemoSeedEnvironment({
      nodeEnv: "development",
      deployEnv: "qa",
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("qa");
  });

  it("checks all deploy env vars and catches production even if another var is empty", () => {
    const result = evaluateDemoSeedEnvironment({
      nodeEnv: "development",
      vercelEnv: " ",
      appEnv: "",
      deployEnv: "production",
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("production");
  });
});
