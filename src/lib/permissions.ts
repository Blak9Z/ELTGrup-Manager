import { PermissionAction, PermissionResource } from "@prisma/client";
import { auth } from "@/src/lib/auth";
import { hasPermission } from "@/src/lib/rbac";

export async function requirePermission(resource: PermissionResource, action: PermissionAction) {
  const session = await auth();

  if (!session?.user) {
    throw new Error("Sesiune invalida. Reautentificare necesara.");
  }

  const allowed = hasPermission(session.user.roleKeys || [], resource, action);
  if (!allowed) {
    throw new Error("Nu ai permisiunea necesara pentru aceasta actiune.");
  }

  return session.user;
}
