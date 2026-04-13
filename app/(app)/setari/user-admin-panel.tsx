"use client";

import { useActionState, useEffect, useMemo } from "react";
import { RoleKey } from "@prisma/client";
import { toast } from "sonner";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { ConfirmSubmitButton } from "@/src/components/forms/confirm-submit-button";
import { Input } from "@/src/components/ui/input";
import { initialActionState } from "@/src/lib/action-state";
import { SUPER_ADMIN_EMAIL } from "@/src/lib/rbac";
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

export function UserAdminPanel({ users, roles }: { users: UserItem[]; roles: RoleOption[] }) {
  const [state, formAction, pending] = useActionState(createUserAction, initialActionState);

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.message) toast.error(state.message);
  }, [state]);

  const orderedRoles = useMemo(() => [...roles].sort((a, b) => a.label.localeCompare(b.label, "ro")), [roles]);

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-[color:var(--border)] bg-[rgba(15,26,45,0.75)] p-4">
        <h2 className="text-lg font-semibold text-[#edf4ff]">Cont nou</h2>
        <form action={formAction} className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <Input name="firstName" placeholder="Prenume" required />
          <Input name="lastName" placeholder="Nume" required />
          <Input name="email" type="email" placeholder="Email" required />
          <Input name="password" type="password" placeholder="Parola initiala" required />
          <select name="roleKey" defaultValue={RoleKey.WORKER}>
            {orderedRoles.map((role) => (
              <option key={role.id} value={role.key}>
                {role.label}
              </option>
            ))}
          </select>
          <Input name="positionTitle" placeholder="Functie (optional)" />
          <div className="md:col-span-2 xl:col-span-3 flex justify-end">
            <Button type="submit" disabled={pending}>{pending ? "Se salveaza..." : "Creeaza cont"}</Button>
          </div>
        </form>
      </section>

      <section className="rounded-2xl border border-[color:var(--border)] bg-[rgba(15,26,45,0.75)] p-4">
        <h2 className="text-lg font-semibold text-[#edf4ff]">Utilizatori si permisiuni</h2>
        <div className="mt-3 space-y-3">
          {users.map((user) => (
            <div key={user.id} className="rounded-xl border border-[color:var(--border)] bg-[rgba(12,22,39,0.85)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-[#edf4ff]">{user.firstName} {user.lastName}</p>
                  <p className="text-xs text-[#9fb2cd]">{user.email}</p>
                </div>
                <Badge tone={user.isActive ? "success" : "danger"}>{user.isActive ? "Activ" : "Inactiv"}</Badge>
              </div>

              <form action={updateUserRolesAction} className="mt-3 space-y-2">
                <input type="hidden" name="userId" value={user.id} />
                <div className="grid gap-2 md:grid-cols-3">
                  {orderedRoles.map((role) => (
                    <label key={role.id} className="flex items-center gap-2 text-xs text-[#cfddf1]">
                      <input type="checkbox" name="roleKeys" value={role.key} defaultChecked={user.roleKeys.includes(role.key)} />
                      {role.label}
                    </label>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <Button variant="secondary" size="sm" type="submit">Salveaza roluri</Button>
                </div>
              </form>

              <form action={toggleUserActiveAction} className="mt-2 flex justify-end">
                <input type="hidden" name="userId" value={user.id} />
                <Button size="sm" variant={user.isActive ? "destructive" : "default"} type="submit">
                  {user.isActive ? "Dezactiveaza" : "Activeaza"}
                </Button>
              </form>

              {user.email.toLowerCase() !== SUPER_ADMIN_EMAIL ? (
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
