import Link from "next/link";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Badge } from "@/src/components/ui/badge";
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
    select: {
      id: true,
      name: true,
      cui: true,
      email: true,
      phone: true,
      notes: true,
      _count: { select: { projects: true, contacts: true } },
    },
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
            <Card key={client.id} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link href={`/clienti/${client.id}`} className="text-base font-bold text-[#c8dcff] hover:underline">
                    {client.name}
                  </Link>
                  <p className="text-xs text-[#9fb1c5]">{client.cui || "Fara CUI"}</p>
                </div>
                <Badge tone="neutral">CRM</Badge>
              </div>
              <p className="text-sm text-[#dce7f9] break-words">{client.email || "-"} • {client.phone || "-"}</p>
              <div className="grid grid-cols-2 gap-2 text-xs text-[#9fb1c5]">
                <p>Proiecte: {client._count.projects}</p>
                <p>Contacte: {client._count.contacts}</p>
              </div>
              <p className="text-xs text-[#9fb1c5]">Note curente: {client.notes || "-"}</p>

              <form action={addClientNote} className="mt-3 space-y-2">
                <input type="hidden" name="id" value={client.id} />
                <Textarea name="note" rows={2} placeholder="Adauga nota operationala" />
                <Button type="submit" size="sm" variant="secondary">
                  Salveaza nota
                </Button>
              </form>
            </Card>
          ))}
        </div>
      </div>
    </PermissionGuard>
  );
}
