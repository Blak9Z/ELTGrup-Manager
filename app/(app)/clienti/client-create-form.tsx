"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { createClientAction } from "./actions";
import { initialActionState } from "@/src/lib/action-state";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";

export function ClientCreateForm() {
  const [state, formAction, pending] = useActionState(createClientAction, initialActionState);

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.message) toast.error(state.message);
  }, [state]);

  return (
    <form action={formAction} className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div>
        <Input name="name" placeholder="Denumire client" required />
        {state.errors?.name ? <p className="mt-1 text-xs text-[#9b1f30]">{state.errors.name[0]}</p> : null}
      </div>
      <Input name="type" placeholder="Tip (COMPANY/PERSON)" defaultValue="COMPANY" required />
      <Input name="cui" placeholder="CUI" />
      <div>
        <Input name="email" type="email" placeholder="Email" />
        {state.errors?.email ? <p className="mt-1 text-xs text-[#9b1f30]">{state.errors.email[0]}</p> : null}
      </div>
      <Input name="phone" placeholder="Telefon" />
      <Input name="billingAddress" placeholder="Adresa facturare" className="md:col-span-2" />
      <Input name="contactName" placeholder="Persoana contact" />
      <div>
        <Input name="contactEmail" placeholder="Email contact" type="email" />
        {state.errors?.contactEmail ? <p className="mt-1 text-xs text-[#9b1f30]">{state.errors.contactEmail[0]}</p> : null}
      </div>
      <Input name="contactPhone" placeholder="Telefon contact" />
      <div className="md:col-span-2 xl:col-span-4 flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? "Se salveaza..." : "Creeaza client"}</Button>
      </div>
    </form>
  );
}
