import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { PageHeader } from "@/src/components/ui/page-header";
import { prisma } from "@/src/lib/prisma";
import { UserAdminPanel } from "./user-admin-panel";

export default async function SetariPage() {
  const [users, roles] = await Promise.all([
    prisma.user.findMany({
      where: { deletedAt: null },
      include: { roles: { include: { role: true } } },
      orderBy: [{ isActive: "desc" }, { firstName: "asc" }],
    }),
    prisma.role.findMany({ orderBy: { label: "asc" } }),
  ]);

  return (
    <PermissionGuard resource="SETTINGS" action="VIEW">
      <div className="space-y-6">
        <PageHeader title="Setari / Administrare" subtitle="Conturi utilizatori, roluri operationale si control acces pe functii" />
        <UserAdminPanel
          roles={roles.map((role) => ({ id: role.id, key: role.key, label: role.label }))}
          users={users.map((user) => ({
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            email: user.email,
            isActive: user.isActive,
            roleKeys: user.roles.map((item) => item.role.key),
          }))}
        />
      </div>
    </PermissionGuard>
  );
}
