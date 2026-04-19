import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { auth } from "@/src/lib/auth";
import { PageHeader } from "@/src/components/ui/page-header";
import { prisma } from "@/src/lib/prisma";
import { hasPermission, hasSuperAdminRole } from "@/src/lib/rbac";
import { UserAdminPanel } from "./user-admin-panel";

export default async function SetariPage() {
  const session = await auth();
  const roleKeys = session?.user?.roleKeys || [];
  const userEmail = session?.user?.email || null;
  const canCreateUsers = hasPermission(roleKeys, "USERS", "CREATE", userEmail);
  const canUpdateUsers = hasPermission(roleKeys, "USERS", "UPDATE", userEmail);
  const canDeleteUsers = hasPermission(roleKeys, "USERS", "DELETE", userEmail);

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
        <PageHeader title="Setari / Administrare" subtitle="Identity & access control: conturi, roluri operationale, activare/dezactivare si audit de acces." />
        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--surface-2)] p-4">
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Utilizatori total</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{users.length}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--surface-2)] p-4">
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Utilizatori activi</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{users.filter((u) => u.isActive).length}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--surface-2)] p-4">
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Roluri disponibile</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">{roles.length}</p>
          </div>
          <div className="rounded-2xl border border-[var(--border)]/80 bg-[var(--surface-2)] p-4">
            <p className="text-[11px] uppercase tracking-[0.1em] text-[var(--muted)]">Super admini</p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
              {users.filter((u) => u.roles.some((r) => r.role.key === "SUPER_ADMIN")).length}
            </p>
          </div>
        </section>
        <UserAdminPanel
          canAssignSuperAdmin={hasSuperAdminRole(session?.user?.roleKeys || [])}
          canCreateUsers={canCreateUsers}
          canUpdateUsers={canUpdateUsers}
          canDeleteUsers={canDeleteUsers}
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
