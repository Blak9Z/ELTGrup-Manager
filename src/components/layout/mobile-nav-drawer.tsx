"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Drawer, DrawerBody, DrawerContent, DrawerHeader, DrawerBackdrop, DrawerDialog, DrawerTrigger } from "@heroui/react";
import { Menu, X } from "lucide-react";
import type { AppModule } from "@/src/lib/access-control";
import { Button } from "@/src/components/ui/button";
import { navItems, navSections } from "@/src/components/layout/navigation-config";
import { cn } from "@/src/lib/utils";

export function MobileNavDrawer({ visibleModules }: { visibleModules: AppModule[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const visibleSet = useMemo(() => new Set(visibleModules), [visibleModules]);

  // Close drawer when navigating
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  // Handle window resize
  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setIsOpen(false);
    };

    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <Drawer isOpen={isOpen} onOpenChange={setIsOpen}>
      <DrawerTrigger>
        <Button
          isIconOnly
          variant="secondary"
          className="h-11 w-11 shrink-0 rounded-xl border-[var(--border)] bg-[var(--surface-card)] lg:hidden"
          aria-label="Deschide meniul"
        >
          <Menu className="h-6 w-6 text-[var(--muted-strong)]" />
        </Button>
      </DrawerTrigger>
      
      <DrawerBackdrop className="bg-black/60 backdrop-blur-sm" />
      <DrawerContent placement="left" className="h-full max-w-[320px] border-r border-[var(--border)] bg-[linear-gradient(180deg,#0d141e,#0a1119)] text-[var(--foreground)]">
        <DrawerDialog className="flex h-full flex-col outline-none">
          <DrawerHeader className="flex flex-col border-b border-[var(--border)] px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">ELTGRUP Manager</p>
                <p className="text-lg font-bold text-[var(--foreground)]">Meniu Principal</p>
              </div>
              <Button
                isIconOnly
                variant="ghost"
                className="h-10 w-10 min-w-0 rounded-xl border border-[var(--border)] bg-[var(--surface-card)]"
                onPress={() => setIsOpen(false)}
                aria-label="Inchide meniul"
              >
                <X className="h-5 w-5 text-[var(--muted-strong)]" />
              </Button>
            </div>
          </DrawerHeader>

          <DrawerBody className="flex-1 gap-8 overflow-y-auto px-6 py-8">
            {navSections.map((section) => {
              const sectionItems = navItems.filter((item) => item.section === section && visibleSet.has(item.module));
              if (!sectionItems.length) return null;

              return (
                <section key={section} className="flex flex-col gap-3">
                  <p className="px-1 text-[11px] font-black uppercase tracking-[0.25em] text-[var(--muted)] opacity-60">{section}</p>
                  <div className="flex flex-col gap-1.5">
                    {sectionItems.map((item) => {
                      const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "relative flex min-h-[52px] items-center gap-4 rounded-2xl border px-4 py-3 text-[15px] font-semibold transition-all active:scale-[0.97]",
                            active
                              ? "border-[var(--border-strong)] bg-[linear-gradient(135deg,rgba(40,64,90,0.6),rgba(20,32,46,0.6))] text-[var(--foreground)] shadow-lg shadow-black/20"
                              : "border-transparent text-[var(--muted-strong)] hover:border-[var(--border)] hover:bg-[var(--surface-card)]",
                          )}
                        >
                          {active ? (
                            <div className="absolute left-0 top-1/2 h-8 w-1.5 -translate-y-1/2 rounded-r-full bg-[#8dc1f5] shadow-[2px_0_10px_rgba(141,193,245,0.4)]" />
                          ) : null}
                          <Icon className={cn("h-5 w-5 shrink-0", active ? "text-[#8dc1f5]" : "text-[var(--muted)]")} />
                          <span className="flex-1 truncate">{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </DrawerBody>
        </DrawerDialog>
      </DrawerContent>
    </Drawer>
  );
}
