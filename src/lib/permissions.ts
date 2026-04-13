import { PermissionAction, PermissionResource } from "@prisma/client";
import { auth } from "@/src/lib/auth";
import { hasPermission, normalizeRoleKeys } from "@/src/lib/rbac";

export async function requirePermission(resource: PermissionResource, action: PermissionAction) {
  const session = await auth();

  if (!session?.user) {
    throw new Error("Sesiune invalida. Reautentificare necesara.");
  }

  const roleKeys = normalizeRoleKeys(session.user.roleKeys || []);
  if (roleKeys.length === 0) {
    throw new Error("Nu ai roluri valide asignate pentru aceasta actiune.");
  }

  const allowed = hasPermission(roleKeys, resource, action, session.user.email);
  if (!allowed) {
    throw new Error("Nu ai permisiunea necesara pentru aceasta actiune.");
  }

  return session.user;
}
