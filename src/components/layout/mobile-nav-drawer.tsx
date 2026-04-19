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
  const [openPath, setOpenPath] = useState<string | null>(null);
  const pathname = usePathname();
  const visibleSet = useMemo(() => new Set(visibleModules), [visibleModules]);
  const open = openPath === pathname;

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1024px)");
    const closeOnDesktop = (event: MediaQueryListEvent) => {
      if (event.matches) setOpenPath(null);
    };

    media.addEventListener("change", closeOnDesktop);
    return () => media.removeEventListener("change", closeOnDesktop);
  }, []);

  return (
    <>
      <Button
        isIconOnly
        variant="secondary"
        className="h-10 w-10 rounded-lg border-[var(--border)] bg-[var(--surface-card)] lg:hidden"
        onPress={() => setOpenPath(pathname)}
        aria-label="Deschide meniul"
      >
        <Menu className="h-5 w-5" />
      </Button>

      <Drawer isOpen={open} onOpenChange={(next) => setOpenPath(next ? pathname : null)}>
        <DrawerContent className="max-w-[320px] border-r border-[var(--border)] bg-[var(--shell)] text-[var(--foreground)]">
          <DrawerHeader className="flex items-center justify-between border-b border-[var(--border)] py-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">ELTGRUP Manager</p>
              <p className="mt-1 text-sm font-semibold text-[var(--foreground)]">Navigatie</p>
            </div>
            <button
              type="button"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-card)] text-[var(--muted-strong)]"
              onClick={() => setOpenPath(null)}
              aria-label="Inchide meniul"
            >
              <X className="h-4 w-4" />
            </button>
          </DrawerHeader>

          <DrawerBody className="gap-4 py-4">
            {navSections.map((section) => {
              const sectionItems = navItems.filter((item) => item.section === section && visibleSet.has(item.module));
              if (!sectionItems.length) return null;

              return (
                <section key={section}>
                  <p className="px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--muted)]">{section}</p>
                  <div className="mt-2 space-y-1">
                    {sectionItems.map((item) => {
                      const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                      const Icon = item.icon;

                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={() => setOpenPath(null)}
                          className={cn(
                            "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition",
                            active
                              ? "border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--foreground)]"
                              : "border-transparent text-[var(--muted-strong)] hover:border-[var(--border)] hover:bg-[var(--surface-card)]",
                          )}
                        >
                          <Icon className={cn("h-4 w-4", active ? "text-[#aac4e2]" : "text-[#8098b5]")} />
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
