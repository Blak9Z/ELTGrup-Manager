import { redirect } from "next/navigation";
import { Sidebar } from "@/src/components/layout/sidebar";
import { Topbar } from "@/src/components/layout/topbar";
import { auth } from "@/src/lib/auth";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user) {
    redirect("/autentificare");
  }

  return (
    <div className="min-h-screen bg-[#f3f7f5] text-[#1b2c21]">
      <div className="flex">
        <Sidebar />
        <div className="min-h-screen flex-1">
          <Topbar />
          <main className="mx-auto w-full max-w-[1600px] p-4 lg:p-6">{children}</main>
        </div>
      </div>
    </div>
  );
}
