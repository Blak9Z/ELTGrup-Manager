"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { AppModule } from "@/src/lib/access-control";
import { ChevronRight } from "lucide-react";
import { cn } from "@/src/lib/utils";
import { navItems, navSections } from "@/src/components/layout/navigation-config";

export function Sidebar({ visibleModules }: { visibleModules: AppModule[] }) {
  const pathname = usePathname();
  const visibleSet = new Set(visibleModules);

  return (
    <aside className="sticky top-0 hidden h-[100dvh] min-h-screen w-[272px] shrink-0 border-r border-[var(--border)]/70 bg-[#0b1421] md:flex md:flex-col">
      <div className="border-b border-[var(--border)]/70 px-4 py-4">
        <div className="flex min-h-[92px] items-center justify-center rounded-xl border border-[var(--border)] bg-[#0e1a29] px-4 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/eltgrup-servicii-wordmark.png"
            alt="ELT Grup Servicii"
            className="h-auto w-full max-w-[210px] object-contain"
            loading="lazy"
          />
        </div>
        <p className="mt-3 px-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8ea5be]">ELTGRUP Manager</p>
      </div>

      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-4">
        {navSections.map((section) => {
          const sectionItems = navItems.filter((item) => item.section === section && visibleSet.has(item.module));
          if (!sectionItems.length) return null;
          return (
            <div key={section} className="space-y-2">
              <p className="px-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8096af]">{section}</p>
              <div className="space-y-1">
                {sectionItems.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group flex items-center gap-2.5 rounded-xl border px-3 py-2.5 text-[13px] font-medium transition",
                        active
                          ? "border-[#405975] bg-[#132336] text-[#edf5ff]"
                          : "border-transparent text-[#a6bacf] hover:border-[#2e4259] hover:bg-[#111e2f] hover:text-[#e2ecf8]",
                      )}
                    >
                      <Icon className={cn("h-4 w-4", active ? "text-[#c2d6ea]" : "text-[#7e94ad] group-hover:text-[#b6c8db]")} />
                      <span className="flex-1">{item.label}</span>
                      <ChevronRight className={cn("h-3.5 w-3.5", active ? "text-[#c2d6ea]" : "text-[#5f738c]")} />
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>

      <div className="border-t border-[var(--border)]/70 px-4 py-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#8ca2ba]">Operational Suite</p>
        <p className="mt-1 text-xs text-[#9fb2c7]">Execution, materials, financial control</p>
      </div>
    </aside>
  );
}
