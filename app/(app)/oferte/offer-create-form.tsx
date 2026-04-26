"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { toast } from "sonner";
import { OfferStatus, ProjectType } from "@prisma/client";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { Input } from "@/src/components/ui/input";
import { createOfferAction } from "./actions";

const initialState: { ok: boolean; message?: string; errors?: Record<string, string[]> } = { ok: false };

type ClientOption = { id: string; name: string };

export function OfferCreateForm({ clients }: { clients: ClientOption[] }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createOfferAction, initialState);
  const [items, setItems] = useState<Array<{ id: number; name: string; quantity: string; unitPrice: string; description: string; category: string }>>([
    { id: 0, name: "", quantity: "1", unitPrice: "", description: "", category: "" },
  ]);

  if (state.ok && state.message) {
    toast.success(state.message);
    state.ok = false;
    setTimeout(() => router.push("/oferte"), 800);
  }
  if (!state.ok && state.message) {
    toast.error(state.message);
  }

  function addItem() {
    setItems((prev) => [...prev, { id: Date.now(), name: "", quantity: "1", unitPrice: "", description: "", category: "" }]);
  }

  function removeItem(id: number) {
    setItems((prev) => prev.filter((item) => item.id !== id));
  }

  function updateItem(id: number, field: string, value: string) {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  }

  const total = items.reduce((sum, item) => {
    const qty = Number(item.quantity) || 0;
    const price = Number(item.unitPrice) || 0;
    return sum + qty * price;
  }, 0);

  return (
    <form action={formAction} className="space-y-6">
      <Card className="space-y-4 p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">Date oferta</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1.5">
            <label className="field-label">Titlu oferta</label>
            <Input name="title" placeholder="Ex: Instalatii electrice + PSI - Hala SIGEMO" required />
            {state.errors?.title ? <p className="text-xs text-[#ffb4bd]">{state.errors.title[0]}</p> : null}
          </div>
          <div className="space-y-1.5">
            <label className="field-label">Client</label>
            <select name="clientId" required className="h-11 w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)]">
              <option value="">Alege clientul</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>{client.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="field-label">Valabila pana la</label>
            <Input name="validUntil" type="date" required />
          </div>
          <div className="space-y-1.5">
            <label className="field-label">Valoare totala estimata (RON)</label>
            <Input name="totalAmount" type="number" min="0" step="0.01" defaultValue={total.toFixed(2)} readOnly className="bg-[var(--surface-2)]" />
          </div>
        </div>
        <div className="space-y-1.5">
          <label className="field-label">Descriere / Observatii</label>
          <textarea name="description" rows={2} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)]" placeholder="Detalii tehnice, domeniu de aplicare..." />
        </div>
        <input type="hidden" name="currency" value="RON" />
      </Card>

      <Card className="space-y-4 p-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-[var(--muted)]">Pozitii oferta</h3>
          <Button type="button" variant="ghost" onClick={addItem} className="h-8 px-3 text-xs">
            + Adauga pozitie
          </Button>
        </div>
        {items.map((item, idx) => (
          <div key={item.id} className="grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 md:grid-cols-[1fr_100px_120px_40px]">
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Denumire</label>
              <input
                name={`item-${idx}-name`}
                value={item.name}
                onChange={(e) => updateItem(item.id, "name", e.target.value)}
                placeholder="Ex: Proiectare executie instalatii electrice"
                required
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Cantitate</label>
              <input
                name={`item-${idx}-quantity`}
                type="number"
                min="0.01"
                step="0.01"
                value={item.quantity}
                onChange={(e) => updateItem(item.id, "quantity", e.target.value)}
                required
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">Pret unitar</label>
              <input
                name={`item-${idx}-unitPrice`}
                type="number"
                min="0"
                step="0.01"
                value={item.unitPrice}
                onChange={(e) => updateItem(item.id, "unitPrice", e.target.value)}
                required
                className="h-10 w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm text-[var(--foreground)]"
              />
            </div>
            <div className="flex items-end">
              {items.length > 1 && (
                <button type="button" onClick={() => removeItem(item.id)} className="h-10 w-10 rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--danger)] transition hover:bg-[var(--danger)]/10">
                  ×
                </button>
              )}
            </div>
          </div>
        ))}
        <div className="flex justify-end">
          <p className="text-lg font-bold text-[var(--foreground)]">
            Total: {total.toLocaleString("ro-RO", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} RON
          </p>
        </div>
      </Card>

      <div className="flex justify-end gap-3">
        <Button type="submit" disabled={pending} className="px-6">
          {pending ? "Se salveaza..." : "Creeaza oferta"}
        </Button>
      </div>
    </form>
  );
}
