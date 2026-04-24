"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Drawer, DrawerBody, DrawerContent, DrawerHeader } from "@heroui/react";
import { Menu, X } from "lucide-react";
import type { AppModule } from "@/src/lib/access-control";
import { Button } from "@/src/components/ui/button";
import { navItems, navSections } from "@/src/components/layout/navigation-config";
import { cn } from "@/src/lib/utils";

export function MobileNavDrawer({ visibleModules }: { visibleModules: AppModule[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();
  const visibleSet = useMemo(() => new Set(visibleModules), [visibleModules]);

  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setIsOpen(false);
    };

    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <>
      <Button
        isIconOnly
        variant="secondary"
        className="h-11 w-11 rounded-lg border-[var(--border)] bg-[var(--surface-card)] lg:hidden"
        onPress={() => setIsOpen(true)}
        aria-label="Deschide meniul"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Drawer isOpen={isOpen} onOpenChange={setIsOpen}>
        <DrawerContent className="max-w-[320px] border-r border-[var(--border)] bg-[linear-gradient(180deg,#0d141e,#0a1119)] text-[var(--foreground)]">
          <DrawerHeader className="flex flex-col border-b border-[var(--border)] px-5 py-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">ELTGRUP Manager</p>
                <p className="mt-1 text-base font-semibold text-[var(--foreground)]">Navigatie</p>
              </div>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-card)] text-[var(--muted-strong)] hover:bg-[var(--surface-2)]"
                onClick={() => setIsOpen(false)}
                aria-label="Inchide meniul"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </DrawerHeader>

          <DrawerBody className="gap-6 px-5 py-6">
            {navSections.map((section) => {
              const sectionItems = navItems.filter((item) => item.section === section && visibleSet.has(item.module));
              if (!sectionItems.length) return null;

              return (
                <section key={section} className="flex flex-col gap-2">
                  <p className="px-1 text-[10px] font-bold uppercase tracking-[0.2em] text-[var(--muted)] opacity-80">{section}</p>
                  <div className="mt-2 space-y-1">
                    {sectionItems.map((item) => {
                      const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          className={cn(
                            "relative flex min-h-[48px] items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium transition-all active:scale-[0.98]",
                            active
                              ? "border-[var(--border-strong)] bg-[linear-gradient(180deg,rgba(30,44,61,0.96),rgba(23,36,50,0.96))] text-[var(--foreground)] shadow-sm"
                              : "border-transparent text-[var(--muted-strong)] hover:border-[var(--border)] hover:bg-[var(--surface-card)]",
                          )}
                        >
                          {active ? <span className="absolute left-0 top-1/2 h-8 w-[4px] -translate-y-1/2 rounded-r-full bg-[#9bc2ea]" /> : null}
                          <Icon className={cn("h-5 w-5", active ? "text-[#aac4e2]" : "text-[#8098b5]")} />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </DrawerBody>
        </DrawerContent>
      </Drawer>
    </>
  );
}
