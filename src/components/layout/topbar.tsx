import Link from "next/link";
import { Bell, Search } from "lucide-react";
import { auth } from "@/src/lib/auth";
import type { AppModule } from "@/src/lib/access-control";
import { prisma } from "@/src/lib/prisma";
import { SignOutButton } from "@/src/components/auth/sign-out-button";
import { Input } from "@/src/components/ui/input";

const mobileQuickLinks = [
  { module: "dashboard" as AppModule, href: "/panou", label: "Panou" },
  { module: "projects" as AppModule, href: "/proiecte", label: "Proiecte" },
  { module: "work_orders" as AppModule, href: "/lucrari", label: "Lucrari" },
  { module: "time_tracking" as AppModule, href: "/pontaj", label: "Pontaj" },
  { module: "field" as AppModule, href: "/teren", label: "Teren" },
];

export async function Topbar({ visibleModules }: { visibleModules: AppModule[] }) {
  const session = await auth();
  const visibleSet = new Set(visibleModules);
  const unreadNotifications = session?.user?.id
    ? await prisma.notification.count({
        where: {
          userId: session.user.id,
          isRead: false,
        },
      })
    : 0;

  return (
    <header className="sticky top-0 z-20 border-b border-[color:var(--border)] bg-[rgba(6,11,22,0.9)] px-4 py-3 backdrop-blur lg:px-6">
      <div className="flex items-center gap-3">
        <div className="relative hidden max-w-[520px] flex-1 md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#768fb0]" />
          <Input
            placeholder="Cauta proiect, lucrare, client, document..."
            className="h-10 rounded-xl pl-9"
          />
        </div>

        <div className="ml-auto flex items-center gap-2 md:gap-3">
          {visibleSet.has("notifications") ? (
            <Link
              href="/notificari"
              className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[color:var(--border)] bg-[rgba(13,23,41,0.9)] text-[#bfd1e9] hover:border-[#385986]"
              aria-label="Notificari"
            >
              <Bell className="h-4 w-4" />
              {unreadNotifications > 0 ? (
                <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full border border-[#822f37] bg-[#bf4755] px-1 text-[10px] font-semibold text-white">
                  {unreadNotifications}
                </span>
              ) : null}
            </Link>
          ) : null}
          <div className="hidden text-right sm:block">
            <p className="text-sm font-semibold text-[#edf3ff]">{session?.user?.name || "Utilizator ELTGRUP"}</p>
            <p className="text-xs text-[#9eb1cb]">Cont activ</p>
          </div>
          <SignOutButton />
        </div>
      </div>

      <nav className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 lg:hidden">
        {mobileQuickLinks.filter((item) => visibleSet.has(item.module)).map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-full border border-[#2d466f] bg-[rgba(20,34,58,0.8)] px-3 py-1.5 text-xs font-semibold text-[#c9daf1]"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
