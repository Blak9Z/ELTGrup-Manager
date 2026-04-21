import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { auth } from "@/src/lib/auth";
import { Badge } from "@/src/components/ui/badge";
import { PageHeader } from "@/src/components/ui/page-header";
import { prisma } from "@/src/lib/prisma";
import { getRolePermissionOverview, hasPermission, hasSuperAdminRole } from "@/src/lib/rbac";
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

  const roleCards = roles.map((role) => ({
    role,
    overview: getRolePermissionOverview(role.key),
  }));

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
        <section className="rounded-2xl border border-[var(--border)]/80 bg-[var(--surface-2)] p-4">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Roluri si permisiuni</p>
              <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Ce poate face fiecare rol</h2>
              <p className="mt-2 max-w-3xl text-sm text-[var(--muted)]">
                Fiecare cont are un singur rol activ. Selectia din panoul de mai jos inlocuieste rolul curent si schimba modulele si actiunile disponibile.
              </p>
            </div>
            <Badge tone="neutral">1 rol activ / cont</Badge>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {roleCards.map(({ role, overview }) => (
              <article key={role.id} className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-[var(--foreground)]">{role.label}</h3>
                    <p className="mt-1 text-xs leading-5 text-[var(--muted)]">{overview.summary}</p>
                  </div>
                  <Badge tone={overview.isFullAccess ? "success" : "neutral"}>
                    {overview.isFullAccess ? "Acces complet" : `${overview.resourceSummaries.length} zone`}
                  </Badge>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {overview.resourceSummaries.slice(0, 4).map((resource) => (
                    <span
                      key={resource.resource}
                      className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted-strong)]"
                    >
                      {resource.label}
                    </span>
                  ))}
                  {overview.resourceSummaries.length > 4 ? (
                    <span className="inline-flex rounded-full border border-[var(--border)] bg-[var(--surface-2)] px-2.5 py-1 text-[11px] font-medium text-[var(--muted-strong)]">
                      +{overview.resourceSummaries.length - 4}
                    </span>
                  ) : null}
                </div>
                <p className="mt-3 text-xs leading-5 text-[var(--muted)]">{overview.restrictions}</p>
              </article>
            ))}
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
