"use client";

import {
  InventoryCondition,
  InventoryInspectionResult,
  InventoryInspectionType,
  InventoryItemType,
} from "@prisma/client";
import { type ReactNode, useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";
import { initialActionState } from "@/src/lib/action-state";
import {
  inventoryConditionLabels,
  inventoryInspectionResultLabels,
  inventoryInspectionTypeLabels,
  inventoryItemTypeLabels,
} from "@/src/lib/inventory-labels";
import {
  adjustInventoryStockAction,
  createInventoryCategoryAction,
  createInventoryInspectionAction,
  createInventoryItemAction,
  createInventoryLocationAction,
  issueInventoryItemAction,
  returnInventoryItemAction,
} from "./actions";

type Option = { id: string; label: string };

type AssignmentOption = { id: string; label: string };

const fieldLabelClass = "text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]";
const selectClassName =
  "h-11 w-full rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3.5 text-sm text-[var(--foreground)] outline-none transition-colors focus:border-[var(--border-strong)] focus:ring-2 focus:ring-[rgba(95,142,193,0.2)] disabled:cursor-not-allowed disabled:opacity-60";
const helperClassName = "text-xs text-[var(--muted)]";

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

function OptionSelect({
  name,
  placeholder,
  options,
  required,
  allowEmpty,
}: {
  name: string;
  placeholder: string;
  options: Option[];
  required?: boolean;
  allowEmpty?: boolean;
}) {
  return (
    <select name={name} required={required} defaultValue="" className={selectClassName}>
      <option value="" disabled={!allowEmpty}>
        {allowEmpty ? `Fara selectie (${placeholder})` : placeholder}
      </option>
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function InventoryCategoryForm() {
  const [state, formAction, pending] = useActionState(createInventoryCategoryAction, initialActionState);
  useActionFeedback(state);

  return (
    <form action={formAction} className="mt-3 grid gap-3 md:grid-cols-2">
      <Field label="Cod categorie" hint="Ex: SCULE_ELECTRICE, APARATE_MASURA.">
        <Input name="code" placeholder="SCULE_ELECTRICE" required />
      </Field>
      <Field label="Nume categorie" hint="Numele afisat in catalog.">
        <Input name="name" placeholder="Scule electrice" required />
      </Field>
      <Field label="Descriere" hint="Optional: ce include categoria." className="md:col-span-2">
        <Input name="description" placeholder="Rotopercutoare, slefuitoare, autofiletante" />
      </Field>
      <div className="md:col-span-2 flex justify-end">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Se salveaza..." : "Adauga categorie"}
        </Button>
      </div>
    </form>
  );
}

export function InventoryLocationForm({ warehouses }: { warehouses: Option[] }) {
  const [state, formAction, pending] = useActionState(createInventoryLocationAction, initialActionState);
  useActionFeedback(state);

  return (
    <form action={formAction} className="mt-3 grid gap-3 md:grid-cols-2">
      <Field label="Depozit" hint="Locatia apartine unui depozit.">
        <OptionSelect name="warehouseId" placeholder="Alege depozitul" options={warehouses} required />
      </Field>
      <Field label="Cod locatie" hint="Ex: DEP-A1-Raft2">
        <Input name="code" placeholder="DEP-A1-RAFT2" required />
      </Field>
      <Field label="Nume locatie" hint="Denumirea scurta din UI.">
        <Input name="name" placeholder="Zona A / Raft 2" required />
      </Field>
      <Field label="Zona" hint="Optional: zona, sector, corp.">
        <Input name="zone" placeholder="Zona A" />
      </Field>
      <Field label="Raft" hint="Optional: raft sau compartiment.">
        <Input name="shelf" placeholder="Raft 2" />
      </Field>
      <Field label="Observatii" hint="Optional: informatii utile pentru magazioner." className="md:col-span-2">
        <Input name="notes" placeholder="Acces cu cheie" />
      </Field>
      <div className="md:col-span-2 flex justify-end">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Se salveaza..." : "Adauga locatie"}
        </Button>
      </div>
    </form>
  );
}

export function InventoryItemForm({
  categories,
  warehouses,
  locations,
}: {
  categories: Option[];
  warehouses: Option[];
  locations: Option[];
}) {
  const [state, formAction, pending] = useActionState(createInventoryItemAction, initialActionState);
  useActionFeedback(state);

  return (
    <form action={formAction} className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      <Field label="Denumire" hint="Numele folosit in operare.">
        <Input name="name" placeholder="Rotopercutor Hilti" required />
      </Field>
      <Field label="Tip articol" hint="Scula, echipament, consumabil sau articol de stoc.">
        <select name="itemType" defaultValue={InventoryItemType.TOOL} className={selectClassName}>
          {Object.values(InventoryItemType).map((type) => (
            <option key={type} value={type}>
              {inventoryItemTypeLabels[type]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Cod intern" hint="Cod inventar unic.">
        <Input name="internalCode" placeholder="SC-0001" required />
      </Field>
      <Field label="Categorie" hint="Grupeaza rapid in stoc.">
        <OptionSelect name="categoryId" placeholder="Alege categoria" options={categories} allowEmpty />
      </Field>
      <Field label="Depozit" hint="Depozitul principal al articolului.">
        <OptionSelect name="warehouseId" placeholder="Alege depozitul" options={warehouses} required />
      </Field>
      <Field label="Locatie" hint="Zona/raft optional.">
        <OptionSelect name="locationId" placeholder="Alege locatia" options={locations} allowEmpty />
      </Field>
      <Field label="Serie" hint="Optional pentru articole serializate.">
        <Input name="serialNumber" placeholder="SN-12345" />
      </Field>
      <Field label="Brand" hint="Ex: Hilti, Bosch, Makita.">
        <Input name="brand" placeholder="Hilti" />
      </Field>
      <Field label="Model" hint="Cod model producator.">
        <Input name="model" placeholder="TE 6-A22" />
      </Field>
      <Field label="UM" hint="Unitate de masura (buc, set, m, kg).">
        <Input name="unitOfMeasure" defaultValue="buc" required />
      </Field>
      <Field label="Cantitate totala" hint="Cantitatea fizica existenta in companie.">
        <Input name="quantityTotal" type="number" min="0" step="0.01" defaultValue="1" required />
      </Field>
      <Field label="Stoc curent" hint="Cantitatea disponibila pentru predare.">
        <Input name="quantityAvailable" type="number" min="0" step="0.01" defaultValue="1" required />
      </Field>
      <Field label="Stoc minim" hint="Prag pentru alerta de aprovizionare.">
        <Input name="minimumStock" type="number" min="0" step="0.01" placeholder="0" />
      </Field>
      <Field label="Data achizitie" hint="Optional.">
        <Input name="purchaseDate" type="date" />
      </Field>
      <Field label="Garantie pana la" hint="Optional.">
        <Input name="warrantyUntil" type="date" />
      </Field>
      <Field label="Expira la" hint="Pentru consumabile/documente de valabilitate.">
        <Input name="expiryDate" type="date" />
      </Field>
      <Field label="Urmatoarea verificare" hint="Data de inspectie/calibrare.">
        <Input name="nextInspectionDate" type="date" />
      </Field>
      <Field label="Observatii" hint="Detalii utile pentru operare." className="xl:col-span-2">
        <Input name="notes" placeholder="Kit complet cu cutie originala" />
      </Field>
      <label className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--muted-strong)]">
        <input type="checkbox" name="requiresReturn" defaultChecked className="h-4 w-4" />
        Necesita retur dupa predare
      </label>
      <div className="md:col-span-2 xl:col-span-3 flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? "Se salveaza..." : "Adauga articol"}</Button>
      </div>
    </form>
  );
}

export function InventoryIssueForm({
  items,
  users,
  projects,
}: {
  items: Option[];
  users: Option[];
  projects: Option[];
}) {
  const [state, formAction, pending] = useActionState(issueInventoryItemAction, initialActionState);
  useActionFeedback(state);

  return (
    <form action={formAction} className="mt-3 grid gap-3 md:grid-cols-2">
      <Field label="Articol" hint="Selecteaza scula/articolul de predat.">
        <OptionSelect name="itemId" placeholder="Alege articolul" options={items} required />
      </Field>
      <Field label="Predat catre" hint="Angajatul care primeste articolul.">
        <OptionSelect name="issuedToUserId" placeholder="Alege persoana" options={users} required />
      </Field>
      <Field label="Proiect" hint="Optional, pentru trasabilitate pe proiect.">
        <OptionSelect name="projectId" placeholder="Alege proiectul" options={projects} allowEmpty />
      </Field>
      <Field label="Cantitate" hint="Cantitatea predata din stoc curent.">
        <Input name="quantity" type="number" min="0.01" step="0.01" defaultValue="1" required />
      </Field>
      <Field label="Data estimata retur" hint="Optional pentru urmarire.">
        <Input name="expectedReturnAt" type="date" />
      </Field>
      <Field label="Conditie la predare" hint="Starea articolului la iesire.">
        <select name="conditionAtIssue" defaultValue={InventoryCondition.GOOD} className={selectClassName}>
          {Object.values(InventoryCondition).map((condition) => (
            <option key={condition} value={condition}>
              {inventoryConditionLabels[condition]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Observatii" hint="Optional: lot, accesorii, instructiuni." className="md:col-span-2">
        <Input name="notes" placeholder="Predat cu incarcator si valiza" />
      </Field>
      <div className="md:col-span-2 flex justify-end">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Se proceseaza..." : "Inregistreaza predare"}
        </Button>
      </div>
    </form>
  );
}

export function InventoryReturnForm({ assignments }: { assignments: AssignmentOption[] }) {
  const [state, formAction, pending] = useActionState(returnInventoryItemAction, initialActionState);
  useActionFeedback(state);

  return (
    <form action={formAction} className="mt-3 grid gap-3 md:grid-cols-2">
      <Field label="Alocare activa" hint="Selecteaza predarea care se inchide.">
        <select name="assignmentId" required defaultValue="" className={selectClassName}>
          <option value="" disabled>
            Alege alocarea
          </option>
          {assignments.map((assignment) => (
            <option key={assignment.id} value={assignment.id}>
              {assignment.label}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Cantitate returnata" hint="Poate fi partiala.">
        <Input name="quantity" type="number" min="0.01" step="0.01" defaultValue="1" required />
      </Field>
      <Field label="Conditie la retur" hint="Starea fizica la primire in depozit.">
        <select name="conditionAtReturn" defaultValue={InventoryCondition.GOOD} className={selectClassName}>
          {Object.values(InventoryCondition).map((condition) => (
            <option key={condition} value={condition}>
              {inventoryConditionLabels[condition]}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--muted-strong)]">
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" name="isDamaged" className="h-4 w-4" />
          Retur cu defect / necesita service
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" name="isLost" className="h-4 w-4" />
          Marcat pierdut
        </label>
      </div>
      <Field label="Observatii" hint="Detalii despre retur, defect sau lipsuri." className="md:col-span-2">
        <Input name="notes" placeholder="Lipseste acumulatorul 2" />
      </Field>
      <div className="md:col-span-2 flex justify-end">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Se proceseaza..." : "Inregistreaza retur"}
        </Button>
      </div>
    </form>
  );
}

export function InventoryAdjustmentForm({ items }: { items: Option[] }) {
  const [state, formAction, pending] = useActionState(adjustInventoryStockAction, initialActionState);
  useActionFeedback(state);

  return (
    <form action={formAction} className="mt-3 grid gap-3 md:grid-cols-2">
      <Field label="Articol" hint="Articolul la care aplici corectia.">
        <OptionSelect name="itemId" placeholder="Alege articolul" options={items} required />
      </Field>
      <Field label="Directie corectie" hint="Plus pentru adaugare, minus pentru scadere.">
        <select name="direction" defaultValue="OUT" className={selectClassName}>
          <option value="IN">Plus (intrare)</option>
          <option value="OUT">Minus (iesire)</option>
        </select>
      </Field>
      <Field label="Cantitate" hint="Cantitatea afectata de corectie.">
        <Input name="quantity" type="number" min="0.01" step="0.01" defaultValue="1" required />
      </Field>
      <label className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 py-2 text-sm text-[var(--muted-strong)]">
        <input type="checkbox" name="affectTotal" className="h-4 w-4" />
        Ajusteaza si cantitatea totala
      </label>
      <Field label="Motiv" hint="Obligatoriu pentru audit inventar." className="md:col-span-2">
        <Input name="reason" placeholder="Inventariere trimestriala" required />
      </Field>
      <Field label="Observatii" hint="Optional: document, persoana, context." className="md:col-span-2">
        <Input name="notes" placeholder="PV inventar #12" />
      </Field>
      <div className="md:col-span-2 flex justify-end">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Se aplica..." : "Aplica corectia"}
        </Button>
      </div>
    </form>
  );
}

export function InventoryInspectionForm({ items }: { items: Option[] }) {
  const [state, formAction, pending] = useActionState(createInventoryInspectionAction, initialActionState);
  useActionFeedback(state);

  return (
    <form action={formAction} className="mt-3 grid gap-3 md:grid-cols-2">
      <Field label="Articol" hint="Articolul verificat.">
        <OptionSelect name="itemId" placeholder="Alege articolul" options={items} required />
      </Field>
      <Field label="Tip verificare" hint="Inspectie, calibrare, garantie, valabilitate.">
        <select name="type" defaultValue={InventoryInspectionType.INSPECTION} className={selectClassName}>
          {Object.values(InventoryInspectionType).map((type) => (
            <option key={type} value={type}>
              {inventoryInspectionTypeLabels[type]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Rezultat" hint="Daca nu trece verificarea, articolul trece in service.">
        <select name="result" defaultValue={InventoryInspectionResult.PASS} className={selectClassName}>
          {Object.values(InventoryInspectionResult).map((result) => (
            <option key={result} value={result}>
              {inventoryInspectionResultLabels[result]}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Data verificare" hint="Implicit azi.">
        <Input name="performedAt" type="date" />
      </Field>
      <Field label="Urmatoarea verificare" hint="Data limita urmatoare.">
        <Input name="nextDueAt" type="date" />
      </Field>
      <Field label="Observatii" hint="Detalii masuratori, constatari, defecte." className="md:col-span-2">
        <Input name="notes" placeholder="Calibrare efectuata de laborator extern" />
      </Field>
      <div className="md:col-span-2 flex justify-end">
        <Button type="submit" variant="secondary" disabled={pending}>
          {pending ? "Se salveaza..." : "Salveaza verificarea"}
        </Button>
      </div>
    </form>
  );
}
