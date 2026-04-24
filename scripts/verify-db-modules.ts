import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const counts = await Promise.all([
    prisma.user.count(),
    prisma.role.count(),
    prisma.userRole.count(),
    prisma.account.count(),
    prisma.session.count(),
    prisma.project.count(),
    prisma.workOrder.count(),
    prisma.material.count(),
    prisma.document.count(),
    prisma.dailySiteReport.count(),
    prisma.notification.count(),
    prisma.inventoryItem.count(),
  ]);

  const [
    users,
    roles,
    userRoles,
    accounts,
    sessions,
    projects,
    workOrders,
    materials,
    documents,
    reports,
    notifications,
    inventoryItems,
  ] = counts;

  const authSmoke = await prisma.user.findFirst({
    select: {
      id: true,
      email: true,
      roles: { select: { role: { select: { key: true } } }, take: 5 },
    },
  });

  const projectSmoke = await prisma.project.findFirst({
    select: {
      id: true,
      code: true,
      title: true,
      client: { select: { id: true, name: true } },
      workOrders: { select: { id: true, title: true }, take: 1 },
      materialUsage: { select: { id: true }, take: 1 },
      documents: { select: { id: true }, take: 1 },
      dailyReports: { select: { id: true }, take: 1 },
    },
  });

  const workOrderSmoke = await prisma.workOrder.findFirst({
    select: {
      id: true,
      title: true,
      projectId: true,
      teamId: true,
      responsibleId: true,
    },
  });

  const materialSmoke = await prisma.material.findFirst({
    select: {
      id: true,
      name: true,
      stockMovements: { select: { id: true, warehouseId: true }, take: 1 },
    },
  });

  const documentSmoke = await prisma.document.findFirst({
    select: {
      id: true,
      fileName: true,
      projectId: true,
      uploadedById: true,
    },
  });

  const reportSmoke = await prisma.dailySiteReport.findFirst({
    select: {
      id: true,
      projectId: true,
      workOrderId: true,
      createdById: true,
    },
  });

  const notificationSmoke = await prisma.notification.findFirst({
    select: {
      id: true,
      userId: true,
      type: true,
      isRead: true,
    },
  });

  console.log(
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        counts: {
          users,
          roles,
          userRoles,
          accounts,
          sessions,
          projects,
          workOrders,
          materials,
          documents,
          reports,
          notifications,
          inventoryItems,
        },
        smoke: {
          auth: authSmoke,
          project: projectSmoke,
          workOrder: workOrderSmoke,
          material: materialSmoke,
          document: documentSmoke,
          report: reportSmoke,
          notification: notificationSmoke,
        },
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
