import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { PageHeader } from "@/src/components/ui/page-header";
import { Textarea } from "@/src/components/ui/textarea";
import { prisma } from "@/src/lib/prisma";
import { addClientNote } from "./actions";
import { ClientCreateForm } from "./client-create-form";

export default async function ClientiPage() {
  const clients = await prisma.client.findMany({ include: { contacts: true, projects: true }, orderBy: { updatedAt: "desc" } });

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
              <p className="text-base font-bold">{client.name}</p>
              <p className="text-xs text-[#5d7064]">{client.cui || "Fara CUI"}</p>
              <p className="mt-2 text-sm text-[#34483b]">{client.email || "-"} • {client.phone || "-"}</p>
              <p className="mt-2 text-xs text-[#607367]">Proiecte: {client.projects.length}</p>
              <p className="text-xs text-[#607367]">Persoane contact: {client.contacts.length}</p>
              <p className="mt-2 text-xs text-[#607367]">Note: {client.notes || "-"}</p>

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
