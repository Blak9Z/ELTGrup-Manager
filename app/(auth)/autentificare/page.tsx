import { redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/panou");

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(1400px_800px_at_15%_0%,rgba(32,162,210,0.22),transparent_55%),radial-gradient(900px_650px_at_100%_100%,rgba(26,132,171,0.22),transparent_50%),#060f1c] px-4">
      <section className="w-full max-w-md rounded-3xl border border-[#2e4d72] bg-[linear-gradient(180deg,rgba(14,29,49,0.96),rgba(9,20,36,0.96))] p-6 shadow-[0_28px_80px_-32px_rgba(0,0,0,0.92)] sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#91bfe2]">ELTGRUP Manager</p>
        <h1 className="mt-2 text-2xl font-semibold text-[#eff7ff]">Platforma operationala pentru constructii</h1>
        <p className="mt-2 text-sm text-[#a6c1dd]">Acces securizat pentru management, echipe de teren si coordonare executie.</p>
        <LoginForm />
      </section>
    </main>
  );
}
