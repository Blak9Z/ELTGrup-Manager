import Link from "next/link";
import { Bell, CalendarClock } from "lucide-react";
import type { AppModule } from "@/src/lib/access-control";
import { getUnreadNotificationCount } from "@/src/lib/notifications";
import { SignOutButton } from "@/src/components/auth/sign-out-button";
import { MobileNavDrawer } from "@/src/components/layout/mobile-nav-drawer";
import { TopbarGlobalSearch } from "@/src/components/ui/topbar-global-search";

const mobileQuickLinks = [
  { module: "dashboard" as AppModule, href: "/panou", label: "Panou" },
  { module: "projects" as AppModule, href: "/proiecte", label: "Proiecte" },
  { module: "work_orders" as AppModule, href: "/lucrari", label: "Lucrari" },
  { module: "time_tracking" as AppModule, href: "/pontaj", label: "Pontaj" },
  { module: "materials" as AppModule, href: "/gestiune-scule", label: "Depozit" },
];

const globalSearchPlaceholder = "Cauta in modulul activ sau foloseste proiect:, lucrare:, document:, depozit:";

function formatTodayLabel() {
  return new Intl.DateTimeFormat("ro-RO", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date());
}

export async function Topbar({
  visibleModules,
  user,
}: {
  visibleModules: AppModule[];
  user: { id: string; name?: string | null };
}) {
  const visibleSet = new Set(visibleModules);
  const unreadNotifications = visibleSet.has("notifications") && user.id ? await getUnreadNotificationCount(user.id) : 0;
  const todayLabel = formatTodayLabel();

  return (
    <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[linear-gradient(180deg,rgba(11,17,24,0.96),rgba(9,15,22,0.92))] px-3 py-2.5 backdrop-blur-xl sm:px-5 lg:px-8">
      <div className="flex min-w-0 items-center gap-3">
        <MobileNavDrawer visibleModules={visibleModules} />

        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[#8dc1f5]" />
            Consola operationala
          </p>
          <p className="truncate text-sm font-semibold text-[var(--foreground)]">ELTGRUP Manager</p>
        </div>

        <TopbarGlobalSearch
          visibleModules={visibleModules}
          className="hidden max-w-[560px] flex-1 xl:block"
          placeholder={globalSearchPlaceholder}
        />

        <div className="ml-auto flex items-center gap-2">
          <div className="hidden items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-2.5 py-1.5 text-xs text-[var(--muted-strong)] lg:flex">
            <CalendarClock className="h-3.5 w-3.5 text-[#9cb5d2]" />
            <span>{todayLabel}</span>
          </div>

          {visibleSet.has("notifications") ? (
            <Link
              href="/notificari"
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface-card)] text-[var(--muted-strong)] transition hover:border-[var(--border-strong)]"
              aria-label="Notificari"
            >
              <Bell className="h-4 w-4" />
              {unreadNotifications > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full border border-[#7f2b38] bg-[#ad4350] px-1 text-[10px] font-semibold text-white">
                  {unreadNotifications}
                </span>
              ) : null}
            </Link>
          ) : null}

          <div className="hidden text-right sm:block">
            <p className="max-w-[190px] truncate text-sm font-semibold text-[var(--foreground)]">{user.name || "Utilizator ELTGRUP"}</p>
            <p className="text-xs text-[var(--muted)]">cont activ</p>
          </div>

          <SignOutButton />
        </div>
      </div>

      <div className="mt-3 xl:hidden">
        <TopbarGlobalSearch visibleModules={visibleModules} placeholder={globalSearchPlaceholder} />
      </div>

      <nav className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 lg:hidden">
        {mobileQuickLinks.filter((item) => visibleSet.has(item.module)).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="inline-flex h-11 min-w-[78px] items-center justify-center rounded-lg border border-[var(--border)] bg-[linear-gradient(180deg,rgba(22,35,50,0.94),rgba(16,27,40,0.94))] px-3 text-xs font-semibold text-[var(--muted-strong)]"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
