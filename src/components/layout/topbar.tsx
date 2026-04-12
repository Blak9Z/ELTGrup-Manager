import { Bell, Search } from "lucide-react";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { SignOutButton } from "@/src/components/auth/sign-out-button";

export async function Topbar() {
  const session = await auth();
  const unreadNotifications = session?.user?.id
    ? await prisma.notification.count({
        where: {
          userId: session.user.id,
          isRead: false,
        },
      })
    : 0;

  return (
    <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-[#dce7df] bg-white/95 px-4 backdrop-blur lg:px-6">
      <div className="relative hidden w-[360px] max-w-full sm:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6e7f73]" />
        <input
          placeholder="Cauta proiect, lucrare, client..."
          className="h-10 w-full rounded-lg border border-[#cbd8d0] bg-[#f8fbf9] pl-9 pr-3 text-sm outline-none focus:ring-2 focus:ring-[#146743]"
        />
      </div>
      <div className="ml-auto flex items-center gap-3">
        <button className="relative rounded-lg border border-[#d5e0d9] p-2 text-[#516458] hover:bg-[#f3f8f5]">
          <Bell className="h-4 w-4" />
          {unreadNotifications > 0 ? (
            <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#c43842] px-1 text-[10px] text-white">
              {unreadNotifications}
            </span>
          ) : null}
        </button>
        <div className="hidden text-right sm:block">
          <p className="text-sm font-semibold text-[#1c2f22]">{session?.user?.name || "Utilizator ELTGRUP"}</p>
          <p className="text-xs text-[#678072]">Utilizator activ</p>
        </div>
        <SignOutButton />
      </div>
    </header>
  );
}
