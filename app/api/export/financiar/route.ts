import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { resolveAccessScope } from "@/src/lib/access-scope";
import { toCsv } from "@/src/lib/csv";
import { hasPermission } from "@/src/lib/rbac";
import { prisma } from "@/src/lib/prisma";

export async function GET() {
  const session = await auth();
  const roles = session?.user?.roleKeys || [];
  if (!session?.user?.id || !hasPermission(roles, "INVOICES", "EXPORT", session?.user?.email)) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const scope = await resolveAccessScope({
    id: session.user.id,
    email: session.user.email,
    roleKeys: session.user.roleKeys || [],
  });

  const invoices = await prisma.invoice.findMany({
    where:
      scope.projectIds === null
        ? {}
        : { projectId: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] } },
    include: { project: true, client: true },
    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
  });
  const data = invoices.map((invoice) => ({
    Factura: invoice.invoiceNumber,
    Proiect: invoice.project.title,
    Client: invoice.client.name,
    Total: invoice.totalAmount.toString(),
    Achitat: invoice.paidAmount.toString(),
    Rest: (Number(invoice.totalAmount) - Number(invoice.paidAmount)).toFixed(2),
    Status: invoice.status,
    Scadenta: invoice.dueDate.toLocaleDateString("ro-RO"),
  }));

  const csv = toCsv(data);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=financiar.csv",
    },
  });
}
