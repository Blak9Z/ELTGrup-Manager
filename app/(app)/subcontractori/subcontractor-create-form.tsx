"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { createSubcontractorAction } from "./actions";
import { SUBCONTRACTOR_APPROVAL_STATUSES } from "./constants";
import { initialActionState } from "@/src/lib/action-state";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { useRouter } from "next/navigation";

export function SubcontractorCreateForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createSubcontractorAction, initialActionState);

  useEffect(() => {
    if (state.ok && state.message) {
      toast.success(state.message);
      // Remove the dialog=create param from URL to close the dialog
      const url = new URL(window.location.href);
      url.searchParams.delete("dialog");
      router.push(url.pathname + url.search);
    }
    if (!state.ok && state.message) toast.error(state.message);
  }, [state, router]);

  return (
    <form action={formAction} className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
      <div>
        <Input name="name" placeholder="Denumire" required />
        {state.errors?.name ? <p className="mt-1 text-xs text-[#ffb4bd]">{state.errors.name[0]}</p> : null}
      </div>
      <Input name="cui" placeholder="CUI" />
      <Input name="contactName" placeholder="Contact" />
      <div>
        <Input name="email" type="email" placeholder="Email" />
        {state.errors?.email ? <p className="mt-1 text-xs text-[#ffb4bd]">{state.errors.email[0]}</p> : null}
      </div>
      <Input name="phone" placeholder="Telefon" />
      <select name="approvalStatus" defaultValue="IN_VERIFICARE" className="h-10 rounded-lg border border-[var(--border)] px-3 text-sm">
        {SUBCONTRACTOR_APPROVAL_STATUSES.map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
      <div className="md:col-span-2 xl:col-span-4 flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? "Se salveaza..." : "Creeaza"}</Button>
      </div>
    </form>
  );
}
