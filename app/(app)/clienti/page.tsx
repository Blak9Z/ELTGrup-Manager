import Link from "next/link";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { PageHeader } from "@/src/components/ui/page-header";
import { Textarea } from "@/src/components/ui/textarea";
import { auth } from "@/src/lib/auth";
import { resolveAccessScope } from "@/src/lib/access-scope";
import { prisma } from "@/src/lib/prisma";
import { addClientNote } from "./actions";
import { ClientCreateForm } from "./client-create-form";

export default async function ClientiPage() {
  const session = await auth();
  const scope = session?.user
    ? await resolveAccessScope({
        id: session.user.id,
        email: session.user.email,
        roleKeys: session.user.roleKeys || [],
      })
    : { projectIds: null, teamId: null };
  const clients = await prisma.client.findMany({
    where:
      scope.projectIds === null
        ? { deletedAt: null }
        : { deletedAt: null, projects: { some: { id: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] } } } },
    include: { contacts: true, projects: true },
    orderBy: { updatedAt: "desc" },
  });

  return (
    <PermissionGuard resource="PROJECTS" action="VIEW">
      <div className="space-y-6">
        <PageHeader title="CRM Clienti" subtitle="Date companie, contacte, proiecte, note operationale si istoric" />

        <Card>
          <h2 className="text-lg font-extrabold">Adauga client</h2>
          <ClientCreateForm />
        </Card>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {clients.map((client) => (
            <Card key={client.id}>
              <Link href={`/clienti/${client.id}`} className="text-base font-bold text-[#c8dcff] hover:underline">
                {client.name}
              </Link>
              <p className="text-xs text-[#9fb3ce]">{client.cui || "Fara CUI"}</p>
              <p className="mt-2 text-sm text-[#dce7f9]">{client.email || "-"} • {client.phone || "-"}</p>
              <p className="mt-2 text-xs text-[#9fb3ce]">Proiecte: {client.projects.length}</p>
              <p className="text-xs text-[#9fb3ce]">Persoane contact: {client.contacts.length}</p>
              <p className="mt-2 text-xs text-[#9fb3ce]">Note: {client.notes || "-"}</p>

              <form action={addClientNote} className="mt-3 space-y-2">
                <input type="hidden" name="id" value={client.id} />
                <Textarea name="note" rows={2} placeholder="Adauga nota operationala" />
                <Button type="submit" size="sm" variant="secondary">Salveaza nota</Button>
              </form>
            </Card>
          ))}
        </div>
      </div>
    </PermissionGuard>
  );
}
