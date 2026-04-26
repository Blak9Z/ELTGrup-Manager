"use server";

import { prisma } from "@/src/lib/prisma";

export async function getProjectProfitability(projectId: string) {
  const [invoices, costs] = await Promise.all([
    prisma.invoice.aggregate({
      where: { projectId },
      _sum: { totalAmount: true, paidAmount: true },
    }),
    prisma.costEntry.aggregate({
      where: { projectId },
      _sum: { amount: true },
    }),
  ]);

  const totalRevenue = Number(invoices._sum.totalAmount ?? 0);
  const totalPaid = Number(invoices._sum.paidAmount ?? 0);
  const totalCosts = Number(costs._sum.amount ?? 0);

  return {
    totalRevenue,
    totalPaid,
    totalCosts,
    grossProfit: totalRevenue - totalCosts,
    marginPercent: totalRevenue > 0 ? ((totalRevenue - totalCosts) / totalRevenue) * 100 : 0,
    collectionRate: totalRevenue > 0 ? (totalPaid / totalRevenue) * 100 : 0,
  };
}
