import { Prisma } from "@prisma/client";
import { prisma } from "@/src/lib/prisma";

export async function logActivity(args: {
  userId?: string | null;
  entityType: string;
  entityId: string;
  action: string;
  diff?: Prisma.JsonValue;
}) {
  await prisma.activityLog.create({
    data: {
      userId: args.userId || null,
      entityType: args.entityType,
      entityId: args.entityId,
      action: args.action,
      diff: (args.diff ?? null) as Prisma.InputJsonValue,
    },
  });
}
