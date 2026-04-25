import { z } from "zod";
import { PermissionAction, PermissionResource } from "@prisma/client";
import { requirePermission } from "./permissions";
import { ActionState, fromZodError } from "./action-state";
import { logActivity } from "./activity-log";

type SafeActionOptions<T extends z.ZodType> = {
  schema?: T;
  permission?: {
    resource: PermissionResource;
    action: PermissionAction;
  };
  activityLog?: {
    entityType: string;
    action: string;
    getEntityId: (result: any) => string;
    getDiff?: (data: z.infer<T>, result: any) => any;
  };
};

export function createSafeAction<T extends z.ZodType, R>(
  options: SafeActionOptions<T>,
  handler: (data: z.infer<T>, user: any) => Promise<R>
) {
  return async (arg1: any, arg2?: any): Promise<ActionState> => {
    // Determine if it's (state, formData) or just (formData)
    const isStateful = arg2 !== undefined;
    const formData = isStateful ? (arg2 as FormData) : (arg1 as FormData);

    try {
      // 1. Auth & Permission Check
      let user = null;
      if (options.permission) {
        user = await requirePermission(options.permission.resource, options.permission.action);
      }

      // 2. Data Validation
      let parsedData: z.infer<T> = {} as any;
      if (options.schema) {
        // Handle FormData correctly for Zod
        // Extract plain object from FormData
        const rawData: Record<string, any> = {};
        for (const key of Array.from(formData.keys())) {
          const values = formData.getAll(key);
          if (values.length > 1) {
            rawData[key] = values;
          } else {
            rawData[key] = values[0];
          }
        }

        const result = options.schema.safeParse(rawData);
        if (!result.success) {
          return fromZodError(result.error);
        }
        parsedData = result.data;
      }

      // 3. Execute Handler
      const result = await handler(parsedData, user);

      // 4. Activity Logging
      if (options.activityLog && user) {
        await logActivity({
          userId: user.id,
          entityType: options.activityLog.entityType,
          entityId: options.activityLog.getEntityId(result),
          action: options.activityLog.action,
          diff: options.activityLog.getDiff ? options.activityLog.getDiff(parsedData, result) : undefined,
        });
      }

      return { ok: true, message: "Acțiune finalizată cu succes." };
    } catch (error: any) {
      console.error("SafeAction Error:", error);
      return {
        ok: false,
        message: error instanceof Error ? error.message : "A apărut o eroare neașteptată.",
      };
    }
  };
}
