"use client";

import { useState } from "react";
import { WorkOrderStatus } from "@prisma/client";
import { Badge } from "@/src/components/ui/badge";
import { TD, TH, Table } from "@/src/components/ui/table";

type Item = {
  id: string;
  title: string;
  startLabel: string;
  projectTitle: string;
  teamName: string;
  status: WorkOrderStatus;
  description: string;
};

export function DashboardScheduleTable({ items }: { items: Item[] }) {
  const [active, setActive] = useState<Item | null>(null);

  if (items.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-4 text-sm text-[var(--muted)]">
        Nu exista lucrari programate pentru intervalul curent.
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2 md:hidden">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface-card)] p-3 text-left shadow-[var(--shadow-float)] transition hover:border-[var(--border-strong)]"
            onClick={() => setActive(item)}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">{item.startLabel}</p>
            <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">{item.title}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{item.projectTitle}</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-xs text-[var(--muted)]">{item.teamName}</p>
              <Badge tone={item.status === "IN_PROGRESS" ? "info" : item.status === "BLOCKED" ? "danger" : item.status === "DONE" ? "success" : "neutral"}>
                {item.status}
              </Badge>
            </div>
          </button>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface-card)] md:block">
        <Table>
          <thead>
            <tr>
              <TH>Ora</TH>
              <TH>Lucrare</TH>
              <TH>Proiect</TH>
              <TH>Echipa</TH>
              <TH>Status</TH>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr
                key={item.id}
                className="cursor-pointer hover:bg-[var(--surface-2)]"
                onClick={() => setActive(item)}
              >
                <TD>{item.startLabel}</TD>
                <TD className="font-semibold text-[#ecf6ff]">{item.title}</TD>
                <TD>{item.projectTitle}</TD>
                <TD>{item.teamName}</TD>
                <TD>
                  <Badge tone={item.status === "IN_PROGRESS" ? "info" : item.status === "BLOCKED" ? "danger" : item.status === "DONE" ? "success" : "neutral"}>
                    {item.status}
                  </Badge>
                </TD>
              </tr>
            ))}
          </tbody>
        </Table>
      </div>

      {active ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(2,9,18,0.72)] p-4"
          onClick={() => setActive(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--shadow-panel)] max-h-[90vh] overflow-y-auto"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Detalii lucrare programata"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-col gap-1">
                <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Detalii lucrare programata</p>
                <h3 className="text-lg font-semibold text-[var(--foreground)]">{active.title}</h3>
              </div>
              <button
                type="button"
                className="rounded-md border border-[var(--border)] px-2 py-1 text-xs font-semibold text-[var(--muted-strong)] hover:border-[var(--border-strong)]"
                onClick={() => setActive(null)}
              >
                Inchide
              </button>
            </div>
            <div className="mt-3 grid gap-3 text-sm text-[var(--muted-strong)] md:grid-cols-2">
              <div>
                <p className="text-xs text-[var(--muted)]">Data/ora</p>
                <p>{active.startLabel}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)]">Proiect</p>
                <p>{active.projectTitle}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)]">Echipa</p>
                <p>{active.teamName}</p>
              </div>
              <div>
                <p className="text-xs text-[var(--muted)]">Status</p>
                <Badge tone={active.status === "IN_PROGRESS" ? "info" : active.status === "BLOCKED" ? "danger" : active.status === "DONE" ? "success" : "neutral"}>
                  {active.status}
                </Badge>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs text-[var(--muted)]">Descriere</p>
                <p>{active.description || "Fara detalii aditionale."}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
