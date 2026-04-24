"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";
import type { AppModule } from "@/src/lib/access-control";
import { cn } from "@/src/lib/utils";
import { navItems, navSections } from "@/src/components/layout/navigation-config";

export function Sidebar({ visibleModules }: { visibleModules: AppModule[] }) {
  const pathname = usePathname();
  const visibleSet = new Set(visibleModules);

  return (
    <aside className="sticky top-0 hidden h-screen w-[272px] shrink-0 overflow-hidden border-r border-[var(--border)] bg-[linear-gradient(180deg,rgba(13,20,30,0.98),rgba(10,17,25,0.98))] lg:flex lg:flex-col">
      <div className="border-b border-[var(--border)] px-4 pb-4 pt-5">
        <div className="rounded-xl border border-[var(--border)] bg-[linear-gradient(180deg,rgba(20,32,46,0.96),rgba(14,24,36,0.96))] px-3 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/eltgrup-servicii-wordmark.png"
            alt="ELT Grup Servicii"
            className="mx-auto h-auto w-full max-w-[198px] object-contain"
            loading="lazy"
          />
        </div>
        <div className="mt-3 flex items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">ELTGRUP Manager</p>
          <span className="inline-flex items-center gap-1 rounded-full border border-[rgba(90,145,198,0.45)] bg-[rgba(63,107,151,0.26)] px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#c6ddf8]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#83baf0]" />
            live
          </span>
        </div>
        <p className="mt-1 text-sm font-medium text-[var(--muted-strong)]">Platforma operationala</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {navSections.map((section) => {
          const sectionItems = navItems.filter((item) => item.section === section && visibleSet.has(item.module));
          if (!sectionItems.length) return null;

          return (
            <section key={section} className="mb-5">
              <p className="px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{section}</p>
              <div className="mt-2 space-y-1">
                {sectionItems.map((item) => {
                  const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "group relative flex items-center gap-2.5 rounded-lg border px-3 py-2 text-[13px] font-medium transition",
                        active
                          ? "border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(30,44,61,0.96),rgba(23,36,50,0.96))] text-[var(--foreground)] shadow-[var(--shadow-float)]"
                          : "border-transparent text-[var(--muted-strong)] hover:border-[var(--border)] hover:bg-[var(--surface-card)] hover:text-[var(--foreground)]",
                      )}
                    >
                      {active ? <span className="absolute left-0 top-1/2 h-7 w-[3px] -translate-y-1/2 rounded-r-full bg-[#9bc2ea]" /> : null}
                      <Icon className={cn("h-4 w-4", active ? "text-[#aac4e2]" : "text-[#788ea9] group-hover:text-[#acc5df]")} />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      <ChevronRight className={cn("h-3.5 w-3.5", active ? "text-[#aac4e2]" : "text-[#627b98]")} />
                    </Link>
                  );
                })}
              </div>
            </section>
          );
        })}
      </nav>

      <div className="border-t border-[var(--border)] px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Strat operational</p>
        <p className="mt-1 text-xs text-[var(--muted-strong)]">Executie proiecte, materiale, trasabilitate financiara</p>
      </div>
    </aside>
  );
}
