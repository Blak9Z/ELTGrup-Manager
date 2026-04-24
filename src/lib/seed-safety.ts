const allowedDemoNodeEnvs = new Set(["development", "test"]);
const allowedDemoDeployEnvs = new Set(["development", "dev", "local", "test"]);
const blockedDemoDeployEnvs = new Set([
  "production",
  "prod",
  "staging",
  "stage",
  "preview",
]);

export type DemoSeedEnvironmentInput = {
  nodeEnv?: string;
  vercelEnv?: string;
  appEnv?: string;
  deployEnv?: string;
};

export type DemoSeedEnvironmentCheck = {
  allowed: boolean;
  nodeEnv: string;
  deployEnvs: string[];
  reason: string;
};

export function normalizeSeedEnv(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function evaluateDemoSeedEnvironment(
  input: DemoSeedEnvironmentInput,
): DemoSeedEnvironmentCheck {
  const nodeEnv = normalizeSeedEnv(input.nodeEnv);
  const deployEnvs = [input.vercelEnv, input.appEnv, input.deployEnv]
    .map(normalizeSeedEnv)
    .filter((value) => value.length > 0);

  if (!allowedDemoNodeEnvs.has(nodeEnv)) {
    return {
      allowed: false,
      nodeEnv,
      deployEnvs,
      reason: "NODE_ENV must be development or test.",
    };
  }

  const disallowedDeployEnv = deployEnvs.find(
    (value) =>
      blockedDemoDeployEnvs.has(value) || !allowedDemoDeployEnvs.has(value),
  );

  if (disallowedDeployEnv) {
    return {
      allowed: false,
      nodeEnv,
      deployEnvs,
      reason: `Deployment environment "${disallowedDeployEnv}" is not allowed for demo seeding.`,
    };
  }

  return {
    allowed: true,
    nodeEnv,
    deployEnvs,
    reason: "",
  };
}
