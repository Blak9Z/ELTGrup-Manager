"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { RoleKey } from "@prisma/client";
import { toast } from "sonner";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { ConfirmSubmitButton } from "@/src/components/forms/confirm-submit-button";
import { Input } from "@/src/components/ui/input";
import { initialActionState } from "@/src/lib/action-state";
import { createUserAction, deleteUserAction, toggleUserActiveAction, updateUserRolesAction } from "./actions";

type RoleOption = { id: string; key: RoleKey; label: string };
type UserItem = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  isActive: boolean;
  roleKeys: RoleKey[];
};

function resolveSingleRole(user: UserItem): RoleKey {
  if (user.roleKeys.includes(RoleKey.SUPER_ADMIN)) {
    return RoleKey.SUPER_ADMIN;
  }
  return user.roleKeys[0] || RoleKey.WORKER;
}

export function UserAdminPanel({
  users,
  roles,
  canAssignSuperAdmin,
  canCreateUsers,
  canUpdateUsers,
  canDeleteUsers,
}: {
  users: UserItem[];
  roles: RoleOption[];
  canAssignSuperAdmin: boolean;
  canCreateUsers: boolean;
  canUpdateUsers: boolean;
  canDeleteUsers: boolean;
}) {
  const [state, formAction, pending] = useActionState(createUserAction, initialActionState);
  const [newUserRole, setNewUserRole] = useState<RoleKey>(RoleKey.WORKER);
  const [confirmNewSuperAdmin, setConfirmNewSuperAdmin] = useState(false);

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.message) toast.error(state.message);
  }, [state]);

  const orderedRoles = useMemo(() => [...roles].sort((a, b) => a.label.localeCompare(b.label, "ro")), [roles]);
  const creatableRoles = useMemo(
    () => orderedRoles.filter((role) => canAssignSuperAdmin || role.key !== RoleKey.SUPER_ADMIN),
    [canAssignSuperAdmin, orderedRoles],
  );

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[var(--border)]/80 bg-[var(--surface-2)] p-4">
        <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Create Account</p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Cont nou</h2>
        {canCreateUsers ? (
          <form action={formAction} className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Input name="firstName" placeholder="Prenume" required />
            <Input name="lastName" placeholder="Nume" required />
            <Input name="email" type="email" placeholder="Email" required />
            <Input name="password" type="password" placeholder="Parola initiala" required />
            <select
              name="roleKey"
              value={newUserRole}
              onChange={(event) => {
                const nextRole = event.target.value as RoleKey;
                setNewUserRole(nextRole);
                if (nextRole !== RoleKey.SUPER_ADMIN) setConfirmNewSuperAdmin(false);
              }}
            >
              {creatableRoles.map((role) => (
                <option key={role.id} value={role.key}>
                  {role.label}
                </option>
              ))}
            </select>
            <Input name="positionTitle" placeholder="Functie (optional)" />
            {newUserRole === RoleKey.SUPER_ADMIN ? (
              <label className="md:col-span-2 xl:col-span-3 flex items-center gap-2 rounded-lg border border-[#f4b87a] bg-[rgba(88,45,12,0.35)] px-3 py-2 text-xs text-[#ffd8ad]">
                <input
                  type="checkbox"
                  name="confirmSuperAdminAssignment"
                  value="CONFIRM_SUPER_ADMIN"
                  checked={confirmNewSuperAdmin}
                  onChange={(event) => setConfirmNewSuperAdmin(event.target.checked)}
                  required
                />
                Confirm explicit atribuirea rolului SUPER_ADMIN.
              </label>
            ) : null}
            <div className="md:col-span-2 xl:col-span-3 flex justify-end">
              <Button type="submit" disabled={pending}>{pending ? "Se salveaza..." : "Creeaza cont"}</Button>
            </div>
          </form>
        ) : (
          <p className="mt-3 text-sm text-[var(--muted)]">Nu ai dreptul de a crea utilizatori noi.</p>
        )}
      </section>

      <section className="rounded-2xl border border-[var(--border)]/80 bg-[var(--surface-2)] p-4">
        <p className="text-[11px] uppercase tracking-[0.12em] text-[var(--muted)]">Access Matrix</p>
        <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">Utilizatori si permisiuni</h2>
        <div className="mt-3 space-y-3">
          {users.map((user) => (
            <div key={user.id} className="rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-[var(--foreground)]">{user.firstName} {user.lastName}</p>
                  <p className="text-xs text-[var(--muted)]">{user.email}</p>
                </div>
                <Badge tone={user.isActive ? "success" : "danger"}>{user.isActive ? "Activ" : "Inactiv"}</Badge>
              </div>

              {canUpdateUsers ? (
                <form action={updateUserRolesAction} className="mt-3 space-y-2">
                  <input type="hidden" name="userId" value={user.id} />
                  <div className="grid gap-2 md:grid-cols-2">
                    <label className="text-xs text-[#cfddf1]">
                      <span className="mb-1 block uppercase tracking-[0.2em] text-[10px] text-[var(--muted)]">Rol activ</span>
                      <select
                        name="roleKey"
                        defaultValue={resolveSingleRole(user)}
                        disabled={user.roleKeys.includes(RoleKey.SUPER_ADMIN) && !canAssignSuperAdmin}
                        className="h-10 w-full rounded-lg border border-[var(--border)] bg-transparent px-3 text-sm text-[var(--foreground)]"
                      >
                        {orderedRoles
                          .filter((role) => {
                            if (role.key !== RoleKey.SUPER_ADMIN) return true;
                            return canAssignSuperAdmin || user.roleKeys.includes(RoleKey.SUPER_ADMIN);
                          })
                          .map((role) => (
                            <option key={role.id} value={role.key}>
                              {role.label}
                            </option>
                          ))}
                      </select>
                    </label>
                    {user.roleKeys.includes(RoleKey.SUPER_ADMIN) && canAssignSuperAdmin ? (
                      <label className="flex items-center gap-2 rounded-lg border border-[#f4b87a] bg-[rgba(88,45,12,0.35)] px-3 py-2 text-xs text-[#ffd8ad]">
                        <input type="checkbox" name="confirmSuperAdminAssignment" value="CONFIRM_SUPER_ADMIN" />
                        Confirm explicit mentinerea rolului SUPER_ADMIN.
                      </label>
                    ) : null}
                  </div>
                  {user.roleKeys.length > 1 ? (
                    <p className="text-xs text-[#ffd8ad]">
                      Contul are mai multe roluri istorice. Salvarea va pastra doar rolul selectat.
                    </p>
                  ) : null}
                  <div className="flex flex-wrap items-center justify-end gap-2">
                    <Button variant="secondary" size="sm" type="submit">Salveaza rol</Button>
                  </div>
                </form>
              ) : null}

              {canUpdateUsers ? (
                <form action={toggleUserActiveAction} className="mt-2 flex justify-end">
                  <input type="hidden" name="userId" value={user.id} />
                  <Button size="sm" variant={user.isActive ? "destructive" : "default"} type="submit">
                    {user.isActive ? "Dezactiveaza" : "Activeaza"}
                  </Button>
                </form>
              ) : null}

              {canDeleteUsers && (!user.roleKeys.includes(RoleKey.SUPER_ADMIN) || canAssignSuperAdmin) ? (
                <form action={deleteUserAction} className="mt-2 flex justify-end">
                  <input type="hidden" name="userId" value={user.id} />
                  <ConfirmSubmitButton
                    variant="destructive"
                    size="sm"
                    text="Sterge cont"
                    confirmMessage="Confirmi stergerea contului? Actiunea invalideaza accesul imediat."
                  />
                </form>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
