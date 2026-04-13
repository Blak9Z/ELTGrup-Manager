import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { resolveAccessScope } from "@/src/lib/access-scope";
import { toCsv } from "@/src/lib/csv";
import { hasPermission } from "@/src/lib/rbac";
import { prisma } from "@/src/lib/prisma";

export async function GET() {
  const session = await auth();
  const roles = session?.user?.roleKeys || [];
  if (!session?.user?.id || !hasPermission(roles, "MATERIALS", "EXPORT", session?.user?.email)) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const scope = await resolveAccessScope({
    id: session.user.id,
    email: session.user.email,
    roleKeys: session.user.roleKeys || [],
  });

  const materials = await prisma.material.findMany({
    where:
      scope.projectIds === null
        ? {}
        : {
            stockMovements: {
              some: { projectId: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] } },
            },
          },
    include: {
      stockMovements:
        scope.projectIds === null
          ? true
          : {
              where: { projectId: { in: scope.projectIds.length ? scope.projectIds : ["__none__"] } },
            },
    },
    orderBy: { name: "asc" },
  });
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

  const csv = toCsv(data);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": "attachment; filename=materiale.csv",
    },
  });
}
