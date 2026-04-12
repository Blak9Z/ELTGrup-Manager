import { redirect } from "next/navigation";
import { auth } from "@/src/lib/auth";
import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";

export default async function LoginPage() {
  const session = await auth();
  if (session?.user) redirect("/panou");

  return (
    <main className="grid min-h-screen place-items-center bg-[radial-gradient(circle_at_top,#d6eadf,transparent_45%),#f2f6f3] px-4">
      <section className="w-full max-w-md rounded-2xl border border-[#d4e1d8] bg-white p-8 shadow-lg shadow-[#d7e7dc]/60">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#1f7449]">ELTGRUP Manager</p>
        <h1 className="mt-2 text-2xl font-black text-[#1d2f22]">Platforma operationala pentru constructii</h1>
        <p className="mt-2 text-sm text-[#5a6f61]">Conectare securizata pentru birou, santier si parteneri.</p>
        <LoginForm />
      </section>
    </main>
  );
}
