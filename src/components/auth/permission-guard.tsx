import { PermissionAction, PermissionResource } from "@prisma/client";
import { auth } from "@/src/lib/auth";
import { getPermissionLabel, hasPermission } from "@/src/lib/rbac";
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
    return (
      <EmptyState
        title="Acces restrictionat"
        description={`Contul tau nu are permisiunea ${getPermissionLabel(resource, action)}. Cere unui administrator sa iti aloce accesul potrivit.`}
      />
    );
  }

  return <>{children}</>;
}
