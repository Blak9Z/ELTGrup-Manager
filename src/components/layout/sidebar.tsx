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
    <aside className="sticky top-0 hidden h-screen w-[272px] shrink-0 overflow-hidden border-r border-[var(--border)] bg-[var(--shell)] lg:flex lg:flex-col">
      <div className="border-b border-[var(--border)] px-4 pb-4 pt-5">
        <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-card)] px-3 py-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/eltgrup-servicii-wordmark.png"
            alt="ELT Grup Servicii"
            className="mx-auto h-auto w-full max-w-[198px] object-contain"
            loading="lazy"
          />
        </div>
        <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">ELTGRUP Manager</p>
        <p className="mt-1 text-sm font-medium text-[var(--muted-strong)]">Operations Platform</p>
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
                        "group flex items-center gap-2.5 rounded-lg border px-3 py-2 text-[13px] font-medium transition",
                        active
                          ? "border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--foreground)] shadow-[var(--shadow-float)]"
                          : "border-transparent text-[var(--muted-strong)] hover:border-[var(--border)] hover:bg-[var(--surface-card)] hover:text-[var(--foreground)]",
                      )}
                    >
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
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">Control Layer</p>
        <p className="mt-1 text-xs text-[var(--muted-strong)]">Project execution, materials, financial traceability</p>
      </div>
    </aside>
  );
}
