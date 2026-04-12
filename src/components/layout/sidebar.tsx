"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BriefcaseBusiness, CalendarDays, ChartColumn, ClipboardList, FileText, HardHat, LayoutDashboard, Package, Receipt, Settings, Smartphone, Timer, Truck, Users } from "lucide-react";
import { cn } from "@/src/lib/utils";

const items = [
  { href: "/panou", label: "Panou", icon: LayoutDashboard },
  { href: "/proiecte", label: "Proiecte", icon: BriefcaseBusiness },
  { href: "/lucrari", label: "Lucrari", icon: ClipboardList },
  { href: "/calendar", label: "Planificare", icon: CalendarDays },
  { href: "/pontaj", label: "Pontaj", icon: Timer },
  { href: "/teren", label: "Mod teren", icon: Smartphone },
  { href: "/materiale", label: "Materiale", icon: Package },
  { href: "/documente", label: "Documente", icon: FileText },
  { href: "/clienti", label: "Clienti", icon: Users },
  { href: "/rapoarte-zilnice", label: "Rapoarte zilnice", icon: HardHat },
  { href: "/subcontractori", label: "Subcontractori", icon: Truck },
  { href: "/financiar", label: "Financiar", icon: Receipt },
  { href: "/analitice", label: "Analitice", icon: ChartColumn },
  { href: "/setari", label: "Setari", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden w-[250px] shrink-0 border-r border-[#d8e2db] bg-white p-4 lg:block">
      <div className="mb-5 rounded-xl bg-[#104f32] p-4 text-white">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#bde6ca]">ELTGRUP Manager</p>
        <p className="mt-1 text-lg font-black leading-tight">Platforma operationala pentru constructii si echipe de teren</p>
      </div>
      <nav className="space-y-1">
        {items.map((item) => {
          const active = pathname === item.href;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition",
                active
                  ? "bg-[#e8f3ed] text-[#0f5f3a]"
                  : "text-[#46584b] hover:bg-[#f2f7f4] hover:text-[#1a2b1f]",
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
