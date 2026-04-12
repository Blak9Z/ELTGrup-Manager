import { NextResponse } from "next/server";
import * as XLSX from "xlsx";
import { auth } from "@/src/lib/auth";
import { hasPermission } from "@/src/lib/rbac";
import { prisma } from "@/src/lib/prisma";

export async function GET() {
  const session = await auth();
  const roles = session?.user?.roleKeys || [];
  if (!session?.user?.id || !hasPermission(roles, "MATERIALS", "EXPORT")) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const materials = await prisma.material.findMany({ include: { stockMovements: true }, orderBy: { name: "asc" } });
  const data = materials.map((material) => {
    const stock = material.stockMovements.reduce((sum, move) => {
      if (move.type === "OUT" || move.type === "WASTE") return sum - Number(move.quantity);
      return sum + Number(move.quantity);
    }, 0);
    return {
      Cod: material.code,
      Material: material.name,
      UM: material.unitOfMeasure,
      StocCurent: stock.toFixed(2),
      CostIntern: material.internalCost?.toString() || "0",
      PragMinim: material.minStockLevel?.toString() || "0",
    };
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Materiale");
  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=materiale.xlsx",
    },
  });
}
