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
    <div className="min-h-screen bg-[radial-gradient(1200px_900px_at_85%_-10%,rgba(53,97,185,0.16),transparent_52%),radial-gradient(1000px_720px_at_-10%_120%,rgba(42,74,138,0.2),transparent_46%),var(--background)] text-[color:var(--foreground)]">
      <div className="flex min-h-screen">
        <Sidebar visibleModules={visibleModules} />
        <div className="min-h-screen flex-1">
          <Topbar visibleModules={visibleModules} user={{ id: session.user.id, name: session.user.name }} />
          <main className="mx-auto w-full max-w-[1680px] p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
