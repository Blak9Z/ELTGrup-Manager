"use client";

import { useActionState, useEffect } from "react";
import { StockMovementType } from "@prisma/client";
import { toast } from "sonner";
import { createMaterialRequestAction, createStockMovementAction } from "./actions";
import { initialActionState } from "@/src/lib/action-state";
import { Button } from "@/src/components/ui/button";
import { Input } from "@/src/components/ui/input";

type Option = { id: string; label: string };

export function MaterialRequestForm({ projects, materials }: { projects: Option[]; materials: Option[] }) {
  const [state, formAction, pending] = useActionState(createMaterialRequestAction, initialActionState);

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.message) toast.error(state.message);
  }, [state]);

  return (
    <form action={formAction} className="mt-3 grid gap-3 md:grid-cols-2">
      <select name="projectId" required className="h-10 rounded-lg border border-[#cfddd3] px-3 text-sm">
        <option value="">Proiect</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>{project.label}</option>
        ))}
      </select>
      <select name="materialId" required className="h-10 rounded-lg border border-[#cfddd3] px-3 text-sm">
        <option value="">Material</option>
        {materials.map((material) => (
          <option key={material.id} value={material.id}>{material.label}</option>
        ))}
      </select>
      <Input name="quantity" type="number" min="0.01" step="0.01" placeholder="Cantitate" required />
      <Input name="note" placeholder="Observatii" />
      {state.errors?.quantity ? <p className="md:col-span-2 text-xs text-[#9b1f30]">{state.errors.quantity[0]}</p> : null}
      <div className="md:col-span-2 flex justify-end">
        <Button type="submit" disabled={pending}>{pending ? "Se trimite..." : "Trimite cererea"}</Button>
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

  useEffect(() => {
    if (state.ok && state.message) toast.success(state.message);
    if (!state.ok && state.message) toast.error(state.message);
  }, [state]);

  return (
    <form action={formAction} className="mt-3 grid gap-3 md:grid-cols-2">
      <select name="type" required className="h-10 rounded-lg border border-[#cfddd3] px-3 text-sm">
        {Object.values(StockMovementType).map((type) => (
          <option key={type} value={type}>{type}</option>
        ))}
      </select>
      <select name="warehouseId" required className="h-10 rounded-lg border border-[#cfddd3] px-3 text-sm">
        <option value="">Depozit</option>
        {warehouses.map((warehouse) => (
          <option key={warehouse.id} value={warehouse.id}>{warehouse.label}</option>
        ))}
      </select>
      <select name="materialId" required className="h-10 rounded-lg border border-[#cfddd3] px-3 text-sm">
        <option value="">Material</option>
        {materials.map((material) => (
          <option key={material.id} value={material.id}>{material.label}</option>
        ))}
      </select>
      <select name="projectId" className="h-10 rounded-lg border border-[#cfddd3] px-3 text-sm">
        <option value="">Fara proiect</option>
        {projects.map((project) => (
          <option key={project.id} value={project.id}>{project.label}</option>
        ))}
      </select>
      <Input name="quantity" type="number" min="0.01" step="0.01" placeholder="Cantitate" required />
      <Input name="note" placeholder="Observatii" />
      {state.errors?.quantity ? <p className="md:col-span-2 text-xs text-[#9b1f30]">{state.errors.quantity[0]}</p> : null}
      <div className="md:col-span-2 flex justify-end">
        <Button type="submit" variant="secondary" disabled={pending}>{pending ? "Se salveaza..." : "Inregistreaza miscarea"}</Button>
      </div>
    </form>
  );
}
