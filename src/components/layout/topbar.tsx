import Link from "next/link";
import { Bell, Search } from "lucide-react";
import type { AppModule } from "@/src/lib/access-control";
import { getUnreadNotificationCount } from "@/src/lib/notifications";
import { SignOutButton } from "@/src/components/auth/sign-out-button";
import { Input } from "@/src/components/ui/input";
import { MobileNavDrawer } from "@/src/components/layout/mobile-nav-drawer";

const mobileQuickLinks = [
  { module: "dashboard" as AppModule, href: "/panou", label: "Panou" },
  { module: "projects" as AppModule, href: "/proiecte", label: "Proiecte" },
  { module: "work_orders" as AppModule, href: "/lucrari", label: "Lucrari" },
  { module: "time_tracking" as AppModule, href: "/pontaj", label: "Pontaj" },
  { module: "field" as AppModule, href: "/teren", label: "Teren" },
];

export async function Topbar({
  visibleModules,
  user,
}: {
  visibleModules: AppModule[];
  user: { id: string; name?: string | null };
}) {
  const visibleSet = new Set(visibleModules);
  const unreadNotifications = user.id ? await getUnreadNotificationCount(user.id) : 0;

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)]/70 bg-[#0c1726]/95 px-3 py-2.5 backdrop-blur-md lg:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <MobileNavDrawer visibleModules={visibleModules} />

        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#849bb4]">ELTGRUP Manager</p>
          <p className="truncate text-sm font-semibold text-[#e2ebf5]">Construction Operations</p>
        </div>

        <div className="relative hidden max-w-[520px] flex-1 xl:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7f9ec3]" />
          <Input
            placeholder="Cauta proiect, lucrare, client, document, factura..."
            className="h-10 rounded-xl border-[#30465d] bg-[#0f1c2d] pl-9"
          />
        </div>

        <div className="ml-auto flex items-center gap-2 md:gap-3">
          {visibleSet.has("notifications") ? (
            <Link
              href="/notificari"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#30465d] bg-[#0f1c2d] text-[#bfd0e4] hover:border-[#425f7e]"
              aria-label="Notificari"
            >
              <Bell className="h-4 w-4" />
              {unreadNotifications > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full border border-[#8d2431] bg-[#b63e4d] px-1 text-[10px] font-semibold text-white">
                  {unreadNotifications}
                </span>
              ) : null}
            </Link>
          ) : null}
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-[#e5edf7]">{user.name || "Utilizator ELTGRUP"}</p>
            <p className="text-xs text-[#9caec1]">Cont activ</p>
          </div>
          <SignOutButton />
        </div>
      </div>

      <div className="relative mt-3 xl:hidden">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7f9ec3]" />
        <Input
          placeholder="Cauta rapid..."
          className="h-10 rounded-xl border-[#30465d] bg-[#0f1c2d] pl-9"
        />
      </div>

      <nav className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 lg:hidden">
        {mobileQuickLinks.filter((item) => visibleSet.has(item.module)).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-full border border-[#30465d] bg-[#101f31] px-3 py-1.5 text-xs font-semibold text-[#c7d8ea]"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
