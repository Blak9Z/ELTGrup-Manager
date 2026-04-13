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
      <div className="overflow-x-auto rounded-xl border border-[color:var(--border)]">
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
                className="cursor-pointer hover:bg-[rgba(45,69,110,0.2)]"
                onClick={() => setActive(item)}
              >
                <TD>{item.startLabel}</TD>
                <TD className="font-semibold text-[#eff5ff]">{item.title}</TD>
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(2,6,15,0.74)] p-4"
          onClick={() => setActive(null)}
          role="presentation"
        >
          <div
            className="w-full max-w-xl border border-[color:var(--border)] bg-[linear-gradient(180deg,rgba(16,28,48,0.98),rgba(10,19,35,0.98))] p-5"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Detalii lucrare programata"
          >
            <div className="flex flex-col gap-1">
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#9fb2cd]">Detalii lucrare programata</p>
              <h3 className="text-lg font-semibold text-[#edf4ff]">{active.title}</h3>
            </div>
            <div className="mt-3 grid gap-3 text-sm text-[#d5e3f8] md:grid-cols-2">
              <div>
                <p className="text-xs text-[#9fb2cd]">Data/ora</p>
                <p>{active.startLabel}</p>
              </div>
              <div>
                <p className="text-xs text-[#9fb2cd]">Proiect</p>
                <p>{active.projectTitle}</p>
              </div>
              <div>
                <p className="text-xs text-[#9fb2cd]">Echipa</p>
                <p>{active.teamName}</p>
              </div>
              <div>
                <p className="text-xs text-[#9fb2cd]">Status</p>
                <Badge tone={active.status === "IN_PROGRESS" ? "info" : active.status === "BLOCKED" ? "danger" : active.status === "DONE" ? "success" : "neutral"}>
                  {active.status}
                </Badge>
              </div>
              <div className="md:col-span-2">
                <p className="text-xs text-[#9fb2cd]">Descriere</p>
                <p>{active.description || "Fara detalii aditionale."}</p>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
