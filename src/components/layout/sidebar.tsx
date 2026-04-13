"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AppModule } from "@/src/lib/access-control";
import {
  BriefcaseBusiness,
  CalendarDays,
  ChartColumn,
  ClipboardList,
  FileText,
  HardHat,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  Smartphone,
  Timer,
  Truck,
  Users,
} from "lucide-react";
import { cn } from "@/src/lib/utils";

const items = [
  { module: "dashboard" as AppModule, href: "/panou", label: "Panou", icon: LayoutDashboard },
  { module: "projects" as AppModule, href: "/proiecte", label: "Proiecte", icon: BriefcaseBusiness },
  { module: "work_orders" as AppModule, href: "/lucrari", label: "Lucrari", icon: ClipboardList },
  { module: "calendar" as AppModule, href: "/calendar", label: "Calendar", icon: CalendarDays },
  { module: "time_tracking" as AppModule, href: "/pontaj", label: "Pontaj", icon: Timer },
  { module: "field" as AppModule, href: "/teren", label: "Teren", icon: Smartphone },
  { module: "materials" as AppModule, href: "/materiale", label: "Materiale", icon: Package },
  { module: "documents" as AppModule, href: "/documente", label: "Documente", icon: FileText },
  { module: "clients" as AppModule, href: "/clienti", label: "Clienti", icon: Users },
  { module: "reports" as AppModule, href: "/rapoarte-zilnice", label: "Rapoarte", icon: HardHat },
  { module: "subcontractors" as AppModule, href: "/subcontractori", label: "Subcontractori", icon: Truck },
  { module: "financial" as AppModule, href: "/financiar", label: "Financiar", icon: Receipt },
  { module: "analytics" as AppModule, href: "/analitice", label: "Analitice", icon: ChartColumn },
  { module: "settings" as AppModule, href: "/setari", label: "Setari", icon: Settings },
];

export function Sidebar({ visibleModules }: { visibleModules: AppModule[] }) {
  const pathname = usePathname();
  const visibleSet = new Set(visibleModules);

  return (
    <aside className="hidden w-[290px] shrink-0 border-r border-[color:var(--border)] bg-[linear-gradient(180deg,#0a111f,#0a1222)] px-4 py-5 lg:block">
      <div className="mb-6 rounded-2xl border border-[#29406a] bg-[linear-gradient(180deg,#13264a,#0f1d38)] p-5">
        <div className="flex min-h-[132px] items-center justify-center rounded-xl bg-[rgba(8,14,28,0.45)] px-4 py-5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/eltgrup-servicii-wordmark.png"
            alt="ELT Grup Servicii"
            className="h-auto w-full max-w-[230px] object-contain"
            loading="lazy"
          />
        </div>
      </div>

      <nav className="space-y-1">
        {items.filter((item) => visibleSet.has(item.module)).map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "border border-[#315a9c] bg-[linear-gradient(180deg,rgba(49,90,156,0.35),rgba(37,68,120,0.25))] text-[#edf3ff]"
                  : "border border-transparent text-[#9eb1ca] hover:border-[#223552] hover:bg-[rgba(27,44,75,0.35)] hover:text-[#dce8f9]",
              )}
            >
              <Icon className={cn("h-4 w-4", active ? "text-[#9cc1ff]" : "text-[#7e98ba] group-hover:text-[#a5c3f7]")} />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
