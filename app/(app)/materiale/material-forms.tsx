"use client";

import { StockMovementType } from "@prisma/client";
import { useActionState, useEffect, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { initialActionState } from "@/src/lib/action-state";
import {
  createMaterialAction,
  createMaterialRequestAction,
  createStockMovementAction,
  uploadMaterialInvoiceAction,
} from "./actions";

type Option = { id: string; label: string };

const fieldLabelClass = "text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]";
const selectClassName =
  "h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3.5 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--border-strong)] focus:ring-2 focus:ring-[rgba(95,142,193,0.2)] disabled:cursor-not-allowed disabled:opacity-60";
const helperClassName = "text-xs text-[var(--muted)]";
const stockMovementLabels: Record<StockMovementType, string> = {
  IN: "Intrare in depozit",
  OUT: "Iesire din depozit",
  TRANSFER: "Transfer intre depozite",
  RETURN: "Returnare in depozit",
  WASTE: "Casare sau pierdere",
  ADJUSTMENT: "Ajustare de inventar",
};

function useActionFeedback(state: { ok: boolean; message?: string | null }) {
  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.message) toast.error(state.message);
  }, [state]);
}

function Field({
  label,
  hint,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`grid gap-1.5 text-sm ${className}`}>
      <span className={fieldLabelClass}>{label}</span>
      {children}
      {hint ? <span className={helperClassName}>{hint}</span> : null}
    </label>
  );
}

export function MaterialRequestForm({ projects, materials }: { projects: Option[]; materials: Option[] }) {
  const [state, formAction, pending] = useActionState(createMaterialRequestAction, initialActionState);
  useActionFeedback(state);

  return (
    <form action={formAction} className="mt-3 grid gap-3 md:grid-cols-2">
      <Field label="Proiect" hint="Cererea merge catre aprobarea de santier." >
        <select name="projectId" required defaultValue="" className={selectClassName}>
          <option value="" disabled>
            Alege proiectul
          </option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Material" hint="Selecteaza materialul necesar pe lucrare.">
        <select name="materialId" required defaultValue="" className={selectClassName}>
          <option value="" disabled>
            Alege materialul
          </option>
          {materials.map((material) => (
            <option key={material.id} value={material.id}>
              {material.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Cantitate" hint="Se trimite in unitatea de masura a materialului.">
        <Input name="quantity" type="number" min="0.01" step="0.01" placeholder="0.00" required />
      </Field>
      <Field label="Observatii" hint="Optional: necesar special, detalii de executie, urgenta.">
        <Input name="note" placeholder="Detalii suplimentare" />
      </Field>
      {state.errors?.quantity ? <p className="md:col-span-2 text-xs text-[#ffb4bd]">{state.errors.quantity[0]}</p> : null}
      <div className="md:col-span-2 flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Se trimite..." : "Trimite cerere"}
        </Button>
      </div>
    </form>
  );
}

export function StockMovementForm({
  projects,
  materials,
  warehouses,
}: {
  projects: Option[];
  materials: Option[];
  warehouses: Option[];
}) {
  const [state, formAction, pending] = useActionState(createStockMovementAction, initialActionState);
  useActionFeedback(state);

  return (
    <form action={formAction} className="mt-3 grid gap-3 md:grid-cols-2">
      <Field
        label="Tip miscare"
        hint="Magazionerul foloseste acest flux pentru intrari, iesiri, retururi si corectii."
      >
        <select name="type" required defaultValue="" className={selectClassName}>
          <option value="" disabled>
            Alege tipul miscarii
          </option>
          {Object.values(StockMovementType).map((type) => (
            <option key={type} value={type}>
              {stockMovementLabels[type]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Depozit" hint="Alege depozitul din care pleaca sau in care intra materialul.">
        <select name="warehouseId" required defaultValue="" className={selectClassName}>
          <option value="" disabled>
            Alege depozitul
          </option>
          {warehouses.map((warehouse) => (
            <option key={warehouse.id} value={warehouse.id}>
              {warehouse.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Material" hint="Selecteaza materialul pentru care inregistrezi miscarea.">
        <select name="materialId" required defaultValue="" className={selectClassName}>
          <option value="" disabled>
            Alege materialul
          </option>
          {materials.map((material) => (
            <option key={material.id} value={material.id}>
              {material.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Proiect" hint="Optional pentru intrari; obligatoriu cand miscarea este pe lucrare.">
        <select name="projectId" defaultValue="" className={selectClassName}>
          <option value="">Fara proiect</option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Cantitate" hint="Se inregistreaza in unitatea de masura a materialului.">
        <Input name="quantity" type="number" min="0.01" step="0.01" placeholder="0.00" required />
      </Field>
      <Field label="Observatii" hint="Ex: aviz, retur santier, corectie inventar sau motivul iesirii.">
        <Input name="note" placeholder="Detalii miscarea" />
      </Field>
      {state.errors?.quantity ? <p className="md:col-span-2 text-xs text-[#ffb4bd]">{state.errors.quantity[0]}</p> : null}
      <div className="md:col-span-2 flex justify-end">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Se salveaza..." : "Inregistreaza miscarea"}
        </Button>
      </div>
    </form>
  );
}

export function MaterialCreateForm() {
  const [state, formAction, pending] = useActionState(createMaterialAction, initialActionState);
  useActionFeedback(state);

  return (
    <form action={formAction} className="mt-3 grid gap-3 md:grid-cols-2">
      <Field label="Cod" hint="Cod unic pentru identificare rapida in depozit." >
        <Input name="code" placeholder="MAT-001" required />
      </Field>
      <Field label="Denumire" hint="Numele afisat in comenzi si in stoc." >
        <Input name="name" placeholder="BCA 25 cm" required />
      </Field>
      <Field label="Unitate" hint="Exemple: kg, m, buc." >
        <Input name="unitOfMeasure" placeholder="buc" required />
      </Field>
      <Field label="Categorie" hint="Optional: finisaje, structura, instalatii etc.">
        <Input name="category" placeholder="Structura" />
      </Field>
      <Field label="Cost intern" hint="Folosit la costurile de proiect." >
        <Input name="internalCost" type="number" min="0" step="0.01" placeholder="0.00" />
      </Field>
      <Field label="Prag minim" hint="Avertizare cand stocul scade sub acest nivel." >
        <Input name="minStockLevel" type="number" min="0" step="0.01" placeholder="0.00" />
      </Field>
      <Field label="Furnizor" hint="Optional: furnizor principal pentru completare rapida.">
        <Input name="supplierName" placeholder="Nume furnizor" />
      </Field>
      <div className="md:col-span-2 flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Se salveaza..." : "Adauga material"}
        </Button>
      </div>
    </form>
  );
}

export function MaterialInvoiceUploadForm({ projects }: { projects: Option[] }) {
  const [state, formAction, pending] = useActionState(uploadMaterialInvoiceAction, initialActionState);
  useActionFeedback(state);

  return (
    <form action={formAction} className="mt-3 grid gap-3 md:grid-cols-2">
      <Field label="Proiect" hint="Leaga factura de proiectul corect pentru trasabilitate.">
        <select name="projectId" required defaultValue="" className={selectClassName}>
          <option value="" disabled>
            Alege proiectul
          </option>
          {projects.map((project) => (
            <option key={project.id} value={project.id}>
              {project.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Numar factura" hint="Numarul fiscal sau referinta din documentul primit.">
        <Input name="invoiceNumber" placeholder="INV-2026-001" required />
      </Field>
      <Field label="Fisier factura" hint="PDF, imagine sau scan." className="md:col-span-2">
        <input name="file" type="file" required className={selectClassName} />
      </Field>
      <Field label="Observatii" hint="Optional: furnizor, marfa, lot sau alte detalii.">
        <Input name="note" placeholder="Detalii suplimentare" />
      </Field>
      <div className="md:col-span-2 flex justify-end">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Se incarca..." : "Incarca factura"}
        </Button>
      </div>
    </form>
  );
}
