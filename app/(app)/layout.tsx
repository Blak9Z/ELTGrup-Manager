import { redirect } from "next/navigation";
import { SignOutButton } from "@/src/components/auth/sign-out-button";
import { EmptyState } from "@/src/components/ui/empty-state";
import { Sidebar } from "@/src/components/layout/sidebar";
import { Topbar } from "@/src/components/layout/topbar";
import { GlobalCommandPalette } from "@/src/components/layout/command-palette";
import { auth } from "@/src/lib/auth";
import { getVisibleModules } from "@/src/lib/access-control";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/autentificare");
  }
  const visibleModules = getVisibleModules({
    email: session.user.email,
    roleKeys: session.user.roleKeys || [],
  });
  if (!visibleModules.length) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[var(--background)] px-4 py-10 text-[color:var(--foreground)]">
        <div className="w-full max-w-xl space-y-4">
          <EmptyState
            title="Cont autenticat fara module active"
            description="Acest cont este conectat, dar nu are niciun modul disponibil. Cere unui administrator sa-i asocieze un rol sau iesi din cont si conecteaza-te cu alt utilizator."
          />
          <div className="flex justify-center">
            <SignOutButton />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-[var(--background)] text-[color:var(--foreground)]">
      <GlobalCommandPalette />
      <div className="mx-auto min-h-screen w-full max-w-[1980px] lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
        <Sidebar visibleModules={visibleModules} />
        <div className="relative min-h-screen min-w-0 lg:border-l lg:border-[var(--border)]/70">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-0 h-48 bg-[linear-gradient(180deg,rgba(116,162,212,0.07),transparent)]" />
          <Topbar visibleModules={visibleModules} user={{ id: session.user.id, name: session.user.name }} />
          <main className="relative z-[1] min-w-0 px-3 py-4 sm:px-5 lg:px-8 lg:py-6">
            <div className="mx-auto w-full max-w-[1640px] min-w-0">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
