import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/src/lib/auth";
import { hasPermission } from "@/src/lib/rbac";
import { prisma } from "@/src/lib/prisma";

export async function GET() {
  const session = await auth();
  const roles = session?.user?.roleKeys || [];
  if (!session?.user?.id || !hasPermission(roles, "INVOICES", "EXPORT")) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const invoices = await prisma.invoice.findMany({ include: { project: true, client: true }, orderBy: { dueDate: "asc" } });
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

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Financiar");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=financiar.xlsx",
    },
  });
}
