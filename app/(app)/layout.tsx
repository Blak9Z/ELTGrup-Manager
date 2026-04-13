import { redirect } from "next/navigation";
import { Sidebar } from "@/src/components/layout/sidebar";
import { Topbar } from "@/src/components/layout/topbar";
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

  return (
    <div className="min-h-screen overflow-x-clip bg-[var(--background)] text-[color:var(--foreground)]">
      <div className="mx-auto min-h-screen w-full max-w-[1920px] md:grid md:grid-cols-[272px_minmax(0,1fr)]">
        <Sidebar visibleModules={visibleModules} />
        <div className="min-h-screen min-w-0 border-l border-[var(--border)]/40 md:border-l">
          <Topbar visibleModules={visibleModules} user={{ id: session.user.id, name: session.user.name }} />
          <main className="mx-auto w-full max-w-[1600px] min-w-0 px-3 py-3 sm:px-4 sm:py-4 lg:px-7 lg:py-6">
            <div className="min-w-0 rounded-2xl border border-[var(--border)]/70 bg-[var(--surface)] p-3 shadow-[0_20px_55px_-45px_rgba(0,0,0,0.95)] sm:p-5 lg:p-6">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
