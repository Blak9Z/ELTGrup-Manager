import { PermissionAction, PermissionResource } from "@prisma/client";
import { auth } from "@/src/lib/auth";
import { hasPermission } from "@/src/lib/rbac";
import { EmptyState } from "@/src/components/ui/empty-state";

export async function PermissionGuard({
  resource,
  action,
  children,
}: {
  resource: PermissionResource;
  action: PermissionAction;
  children: React.ReactNode;
}) {
  const session = await auth();
  const roles = session?.user?.roleKeys || [];

  if (!hasPermission(roles, resource, action, session?.user?.email)) {
    return <EmptyState title="Acces restrictionat" description="Nu ai permisiunea necesara pentru aceasta sectiune." />;
  }

  return <>{children}</>;
}
