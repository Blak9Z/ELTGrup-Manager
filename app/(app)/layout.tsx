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
      <div className="mx-auto min-h-screen w-full max-w-[1980px] lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
        <Sidebar visibleModules={visibleModules} />
        <div className="min-h-screen min-w-0 lg:border-l lg:border-[var(--border)]/70">
          <Topbar visibleModules={visibleModules} user={{ id: session.user.id, name: session.user.name }} />
          <main className="min-w-0 px-3 py-4 sm:px-5 lg:px-8 lg:py-6">
            <div className="mx-auto w-full max-w-[1640px] min-w-0">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}
