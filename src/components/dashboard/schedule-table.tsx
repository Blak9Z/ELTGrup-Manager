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

  return (
    <>
      <div className="space-y-2 md:hidden">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            className="w-full rounded-xl border border-[var(--border)]/70 bg-[#132235] p-3 text-left shadow-[0_16px_30px_-26px_rgba(0,0,0,0.72)] transition hover:border-[#506b89]"
            onClick={() => setActive(item)}
          >
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#8ea2b8]">{item.startLabel}</p>
            <p className="mt-1 text-sm font-semibold text-[#edf7ff]">{item.title}</p>
            <p className="mt-1 text-xs text-[#9fb1c5]">{item.projectTitle}</p>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-xs text-[#9fb1c5]">{item.teamName}</p>
              <Badge tone={item.status === "IN_PROGRESS" ? "info" : item.status === "BLOCKED" ? "danger" : item.status === "DONE" ? "success" : "neutral"}>
                {item.status}
              </Badge>
            </div>
          </button>
        ))}
      </div>

      <div className="hidden overflow-x-auto rounded-xl border border-[var(--border)] md:block">
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
                className="cursor-pointer hover:bg-[#16283b]"
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
            className="w-full max-w-xl rounded-2xl border border-[var(--border)]/80 bg-[var(--surface-2)] p-5 shadow-[0_26px_56px_-34px_rgba(0,0,0,0.88)]"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Detalii lucrare programata"
          >
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#95b1cf]">Detalii lucrare programata</p>
              <h3 className="text-lg font-semibold text-[#edf7ff]">{active.title}</h3>
            </div>
            <div className="mt-3 grid gap-3 text-sm text-[#d5e6fa] md:grid-cols-2">
              <div>
                <p className="text-xs text-[#95b1cf]">Data/ora</p>
                <p>{active.startLabel}</p>
              </div>
              <div>
                <p className="text-xs text-[#95b1cf]">Proiect</p>
                <p>{active.projectTitle}</p>
              </div>
              <div>
                <p className="text-xs text-[#95b1cf]">Echipa</p>
                <p>{active.teamName}</p>
              </div>
              <div>
                <p className="text-xs text-[#95b1cf]">Status</p>
                <Badge tone={active.status === "IN_PROGRESS" ? "info" : active.status === "BLOCKED" ? "danger" : active.status === "DONE" ? "success" : "neutral"}>
                  {active.status}
                </Badge>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs text-[#95b1cf]">Descriere</p>
                <p>{active.description || "Fara detalii aditionale."}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
