import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/prisma";

const SENSITIVE_FIELDS = ["password", "passwordHash", "secret", "token", "key", "apiKey"];

function redactRecursive(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;
  if (Array.isArray(obj)) return obj.map(redactRecursive);
  
  const redacted: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (SENSITIVE_FIELDS.some(field => key.toLowerCase().includes(field.toLowerCase()))) {
      redacted[key] = "[REDACTED]";
    } else if (typeof value === "object") {
      redacted[key] = redactRecursive(value);
    } else {
      redacted[key] = value;
    }
  }
  return redacted;
}

export async function logActivity(args: {
  userId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  diff?: Prisma.JsonValue;
}) {
  const diff = args.diff ? redactRecursive(args.diff) : null;

  await prisma.activityLog.create({
    data: {
      userId: args.userId || null,
      entityType: args.entityType,
      entityId: args.entityId,
      action: args.action,
      diff: diff as Prisma.InputJsonValue,
    },
  });
}
