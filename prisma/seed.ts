import { PrismaClient, Prisma, RoleKey, PermissionAction, PermissionResource, ProjectStatus, ProjectType, TaskPriority, WorkOrderStatus, TimeEntryStatus, StockMovementType, InvoiceStatus, CostType, DocumentCategory, NotificationType, EquipmentStatus, MaterialRequestStatus, ClientType, SubcontractorApprovalStatus, AssignmentStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, subDays } from "date-fns";

const prisma = new PrismaClient();

const roleLabels: Record<RoleKey, string> = {
  SUPER_ADMIN: "Super Admin",
  ADMINISTRATOR: "Administrator",
  PROJECT_MANAGER: "Manager de proiect",
  SITE_MANAGER: "Sef de santier",
  BACKOFFICE: "Backoffice / Dispecer",
  WORKER: "Muncitor / Tehnician",
  ACCOUNTANT: "Contabil",
  CLIENT_VIEWER: "Client Viewer",
  SUBCONTRACTOR: "Subcontractor",
};

const projectTypes = [
  ProjectType.RESIDENTIAL,
  ProjectType.COMMERCIAL,
  ProjectType.INDUSTRIAL,
  ProjectType.INFRASTRUCTURE,
  ProjectType.MAINTENANCE,
];

const statuses = [
  ProjectStatus.ACTIVE,
  ProjectStatus.PLANNED,
  ProjectStatus.BLOCKED,
  ProjectStatus.COMPLETED,
];

function decimal(n: number) {
  return new Prisma.Decimal(n.toFixed(2));
}

function rand(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function createSequential<T, R>(items: T[], create: (item: T, index: number) => Promise<R>) {
  const results: R[] = [];
  for (let index = 0; index < items.length; index++) {
    results.push(await create(items[index], index));
  }
  return results;
}

async function main() {
  await prisma.rolePermission.deleteMany();
  await prisma.userRole.deleteMany();
  await prisma.permission.deleteMany();
  await prisma.role.deleteMany();

  await prisma.activityLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.comment.deleteMany();
  await prisma.dailySiteReport.deleteMany();
  await prisma.costEntry.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.document.deleteMany();
  await prisma.subcontractorAssignment.deleteMany();
  await prisma.subcontractor.deleteMany();
  await prisma.equipmentAssignment.deleteMany();
  await prisma.equipment.deleteMany();
  await prisma.projectMaterialUsage.deleteMany();
  await prisma.materialRequest.deleteMany();
  await prisma.stockMovement.deleteMany();
  await prisma.material.deleteMany();
  await prisma.warehouse.deleteMany();
  await prisma.timeEntry.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.taskChecklistItem.deleteMany();
  await prisma.workOrder.deleteMany();
  await prisma.projectPhase.deleteMany();
  await prisma.project.deleteMany();
  await prisma.clientContact.deleteMany();
  await prisma.client.deleteMany();
  await prisma.workerProfile.deleteMany();
  await prisma.team.deleteMany();
  await prisma.session.deleteMany();
  await prisma.account.deleteMany();
  await prisma.user.deleteMany();

  const roles = await createSequential(Object.values(RoleKey), (key) =>
    prisma.role.create({
      data: {
        key,
        label: roleLabels[key],
        description: `Rol operational ${roleLabels[key]}`,
      },
    }),
  );

  const permissionTuples = Object.values(PermissionResource).flatMap((resource) =>
    Object.values(PermissionAction).map((action) => ({ resource, action })),
  );
  const permissions = await createSequential(permissionTuples, (item) =>
    prisma.permission.create({
      data: {
        resource: item.resource,
        action: item.action,
        label: `${item.resource}_${item.action}`,
      },
    }),
  );

  for (const role of roles) {
    for (const permission of permissions) {
      const siteManagerDeniedResources: PermissionResource[] = [
        PermissionResource.SETTINGS,
        PermissionResource.USERS,
      ];
      const workerResources: PermissionResource[] = [
        PermissionResource.TASKS,
        PermissionResource.TIME_TRACKING,
        PermissionResource.MATERIALS,
        PermissionResource.DOCUMENTS,
      ];
      const workerActions: PermissionAction[] = [
        PermissionAction.VIEW,
        PermissionAction.CREATE,
        PermissionAction.UPDATE,
      ];
      const accountantResources: PermissionResource[] = [
        PermissionResource.INVOICES,
        PermissionResource.REPORTS,
        PermissionResource.PROJECTS,
      ];
      const backofficeResources: PermissionResource[] = [
        PermissionResource.PROJECTS,
        PermissionResource.TASKS,
        PermissionResource.TEAMS,
        PermissionResource.TIME_TRACKING,
        PermissionResource.MATERIALS,
        PermissionResource.DOCUMENTS,
        PermissionResource.REPORTS,
      ];
      const clientResources: PermissionResource[] = [
        PermissionResource.PROJECTS,
        PermissionResource.DOCUMENTS,
        PermissionResource.INVOICES,
        PermissionResource.REPORTS,
      ];
      const subcontractorResources: PermissionResource[] = [
        PermissionResource.TASKS,
        PermissionResource.DOCUMENTS,
        PermissionResource.REPORTS,
      ];

      const baseAllowed =
        role.key === RoleKey.SUPER_ADMIN ||
        role.key === RoleKey.ADMINISTRATOR ||
        (role.key === RoleKey.PROJECT_MANAGER && permission.resource !== PermissionResource.SETTINGS) ||
        (role.key === RoleKey.SITE_MANAGER &&
          !siteManagerDeniedResources.includes(permission.resource)) ||
        (role.key === RoleKey.WORKER &&
          workerResources.includes(permission.resource) &&
          workerActions.includes(permission.action)) ||
        (role.key === RoleKey.ACCOUNTANT &&
          accountantResources.includes(permission.resource)) ||
        (role.key === RoleKey.BACKOFFICE &&
          backofficeResources.includes(permission.resource)) ||
        (role.key === RoleKey.CLIENT_VIEWER &&
          permission.action === PermissionAction.VIEW &&
          clientResources.includes(permission.resource)) ||
        (role.key === RoleKey.SUBCONTRACTOR &&
          permission.action === PermissionAction.VIEW &&
          subcontractorResources.includes(permission.resource));

      if (baseAllowed) {
        await prisma.rolePermission.create({
          data: { roleId: role.id, permissionId: permission.id },
        });
      }
    }
  }

  const passwordHash = await bcrypt.hash("eltgrup", 10);

  const userSeeds = [
    ["Eduard", "Administrator", "eduard@eltgrup.com", RoleKey.SUPER_ADMIN],
    ["Maria", "Ionescu", "maria.ionescu@eltgrup.ro", RoleKey.ADMINISTRATOR],
    ["Mihai", "Radu", "mihai.radu@eltgrup.ro", RoleKey.PROJECT_MANAGER],
    ["Andrei", "Stoica", "andrei.stoica@eltgrup.ro", RoleKey.SITE_MANAGER],
    ["Ioana", "Dobre", "ioana.dobre@eltgrup.ro", RoleKey.BACKOFFICE],
    ["Razvan", "Nistor", "razvan.nistor@eltgrup.ro", RoleKey.WORKER],
    ["Vlad", "Serban", "vlad.serban@eltgrup.ro", RoleKey.WORKER],
    ["Carmen", "Georgescu", "carmen.georgescu@eltgrup.ro", RoleKey.ACCOUNTANT],
    ["Client", "Demo", "client.demo@eltgrup.ro", RoleKey.CLIENT_VIEWER],
    ["Subcontractor", "Demo", "sub.demo@eltgrup.ro", RoleKey.SUBCONTRACTOR],
  ] as const;

  const superAdminSeedCount = userSeeds.filter(([, , , roleKey]) => roleKey === RoleKey.SUPER_ADMIN).length;
  if (superAdminSeedCount !== 1) {
    throw new Error(`Seed must include exactly one SUPER_ADMIN user. Found: ${superAdminSeedCount}`);
  }

  const users = [] as { id: string; role: RoleKey; name: string }[];
  for (const [firstName, lastName, email, roleKey] of userSeeds) {
    const role = roles.find((r) => r.key === roleKey)!;
    const user = await prisma.user.create({
      data: {
        firstName,
        lastName,
        email,
        phone: `07${rand(10, 99)}${rand(100000, 999999)}`,
        passwordHash,
        roles: { create: { roleId: role.id } },
      },
    });
    users.push({ id: user.id, role: roleKey, name: `${firstName} ${lastName}` });
  }

  const teams = await createSequential(
    ["Echipa Instalatii Electrice", "Echipa Reabilitari", "Echipa Service Mentenanta", "Echipa Infrastructura"],
    (name, index) =>
      prisma.team.create({
        data: {
          code: `ECH-${index + 1}`,
          name,
          region: ["Bucuresti", "Cluj", "Iasi", "Timisoara"][index],
          leadUserId: users[index + 2]?.id,
        },
      }),
  );

  const workerUsers = users.filter((u) => u.role === RoleKey.WORKER || u.role === RoleKey.SITE_MANAGER);
  for (const [i, worker] of workerUsers.entries()) {
    await prisma.workerProfile.create({
      data: {
        userId: worker.id,
        teamId: teams[i % teams.length].id,
        employeeCode: `EMP-${100 + i}`,
        positionTitle: worker.role === RoleKey.SITE_MANAGER ? "Sef de santier" : "Tehnician electric",
        hourlyRate: decimal(45 + i * 8),
        hireDate: subDays(new Date(), 300 + i * 17),
      },
    });
  }

  const clients = await createSequential(
    [
      "Construct Invest SRL",
      "Nord Industrial Park SA",
      "Primaria Cluj-Napoca",
      "Retail Hub Romania",
      "Logistic Future SRL",
      "Energo Center SA",
    ],
    (name, index) =>
      prisma.client.create({
        data: {
          type: ClientType.COMPANY,
          name,
          cui: `RO${40000000 + index * 712}`,
          registrationNumber: `J40/${1000 + index}/2018`,
          vatCode: "RO19",
          phone: `031 900 ${10 + index}`,
          email: `contact${index + 1}@client.ro`,
          billingAddress: `Str. Constructorilor ${index + 3}, Romania`,
          contacts: {
            create: {
              fullName: `Contact ${index + 1}`,
              roleTitle: "Manager tehnic",
              email: `manager${index + 1}@client.ro`,
              phone: `0721 11${index} ${index}${index}`,
              isPrimary: true,
            },
          },
        },
      }),
  );

  const manager = users.find((u) => u.role === RoleKey.PROJECT_MANAGER)!;
  const siteManager = users.find((u) => u.role === RoleKey.SITE_MANAGER)!;

  const projects = [] as { id: string; title: string }[];
  for (let i = 0; i < 12; i++) {
    const project = await prisma.project.create({
      data: {
        code: `ELT-${2026}-${(i + 1).toString().padStart(3, "0")}`,
        title: [
          "Modernizare instalatii electrice hala",
          "Extindere tablou general distributie",
          "Mentenanta preventiva cladire birouri",
          "Reabilitare iluminat exterior",
          "Automatizare pompare industriala",
          "Modernizare infrastructura cablare",
        ][i % 6] + ` #${i + 1}`,
        description: "Proiect operational ELT Grup cu monitorizare zilnica in teren.",
        status: statuses[i % statuses.length],
        type: projectTypes[i % projectTypes.length],
        siteAddress: `Bd. Santierului ${10 + i}, Romania`,
        siteLatitude: new Prisma.Decimal((44.40 + i * 0.01).toFixed(7)),
        siteLongitude: new Prisma.Decimal((26.10 + i * 0.02).toFixed(7)),
        contractValue: decimal(120000 + i * 17000),
        estimatedBudget: decimal(95000 + i * 14000),
        progressPercent: rand(10, 95),
        startDate: subDays(new Date(), rand(20, 150)),
        endDate: addDays(new Date(), rand(30, 200)),
        managerId: i % 2 === 0 ? manager.id : siteManager.id,
        clientId: clients[i % clients.length].id,
        internalNotes: "Atentie la sincronizarea livrarilor de materiale.",
        riskIssuesLog: "Risc intarziere aprovizionare conductor 5x16.",
        phases: {
          create: [
            { title: "Pregatire santier", position: 1 },
            { title: "Executie lucrari", position: 2 },
            { title: "Teste si receptie", position: 3 },
          ],
        },
      },
      include: { phases: true },
    });
    projects.push({ id: project.id, title: project.title });
  }

  const allPhases = await prisma.projectPhase.findMany();
  const teamIds = teams.map((t) => t.id);
  const responsibleRoles: RoleKey[] = [
    RoleKey.SITE_MANAGER,
    RoleKey.WORKER,
    RoleKey.PROJECT_MANAGER,
  ];
  const responsibleUsers = users.filter((u) => responsibleRoles.includes(u.role));

  const workOrders = [] as { id: string; projectId: string }[];
  for (let i = 0; i < 50; i++) {
    const project = projects[i % projects.length];
    const phase = allPhases[(i * 2) % allPhases.length];
    const wo = await prisma.workOrder.create({
      data: {
        projectId: project.id,
        phaseId: phase.id,
        title: `Lucrare #${i + 1} - ${["Montaj corpuri", "Trasee cabluri", "Probe functionale", "Remediere neconformitati"][i % 4]}`,
        description: "Executie in teren cu poze inainte/dupa si checklist obligatoriu.",
        siteLocation: `Zona ${String.fromCharCode(65 + (i % 5))}`,
        responsibleId: responsibleUsers[i % responsibleUsers.length].id,
        teamId: teamIds[i % teamIds.length],
        startDate: subDays(new Date(), rand(1, 15)),
        dueDate: addDays(new Date(), rand(1, 20)),
        estimatedHours: decimal(rand(4, 40)),
        actualHours: decimal(rand(1, 36)),
        status: [WorkOrderStatus.TODO, WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.BLOCKED, WorkOrderStatus.DONE][i % 4],
        priority: [TaskPriority.MEDIUM, TaskPriority.HIGH, TaskPriority.LOW, TaskPriority.CRITICAL][i % 4],
        approvalRequired: i % 3 === 0,
        checklistItems: {
          create: [
            { label: "Verificare echipament" },
            { label: "Executie lucrare" },
            { label: "Foto final + semnatura" },
          ],
        },
      },
    });
    workOrders.push({ id: wo.id, projectId: project.id });
  }

  const materials = await createSequential(
    [
      ["MAT-001", "Cablu FY 3x2.5", "m"],
      ["MAT-002", "Doza aparat 68", "buc"],
      ["MAT-003", "Tub copex 25", "m"],
      ["MAT-004", "Tablou electric 24M", "buc"],
      ["MAT-005", "Intrerupator diferential", "buc"],
      ["MAT-006", "Corp iluminat LED", "buc"],
    ] as const,
    ([code, name, uom], i) =>
      prisma.material.create({
        data: {
          code,
          name,
          unitOfMeasure: uom,
          category: "Electrice",
          supplierName: "Distribuitor Construct",
          purchasePrice: decimal(12 + i * 4),
          internalCost: decimal(15 + i * 5),
          minStockLevel: decimal(50),
        },
      }),
  );

  const warehouses = await createSequential(
    ["Depozit Bucuresti", "Depozit Cluj", "Depozit Iasi"],
    (name, i) =>
      prisma.warehouse.create({
        data: {
          code: `DEP-${i + 1}`,
          name,
          address: `Str. Depozitului ${i + 1}`,
          managerName: `Gestionar ${i + 1}`,
        },
      }),
  );

  for (let i = 0; i < 100; i++) {
    await prisma.stockMovement.create({
      data: {
        materialId: materials[i % materials.length].id,
        warehouseId: warehouses[i % warehouses.length].id,
        projectId: projects[i % projects.length].id,
        type: [StockMovementType.IN, StockMovementType.OUT, StockMovementType.WASTE, StockMovementType.RETURN][i % 4],
        quantity: decimal(rand(5, 150)),
        unitCost: decimal(rand(5, 100)),
        movedAt: subDays(new Date(), rand(0, 60)),
        note: "Miscare stoc automata seed",
      },
    });
  }

  const requesterRoles: RoleKey[] = [
    RoleKey.BACKOFFICE,
    RoleKey.SITE_MANAGER,
    RoleKey.WORKER,
  ];
  const approverRoles: RoleKey[] = [
    RoleKey.PROJECT_MANAGER,
    RoleKey.SITE_MANAGER,
    RoleKey.ADMINISTRATOR,
  ];
  const requesters = users.filter((user) => requesterRoles.includes(user.role));
  const approvers = users.filter((user) => approverRoles.includes(user.role));

  for (let i = 0; i < 35; i++) {
    const status = [MaterialRequestStatus.PENDING, MaterialRequestStatus.APPROVED, MaterialRequestStatus.REJECTED, MaterialRequestStatus.ISSUED][i % 4];
    await prisma.materialRequest.create({
      data: {
        projectId: projects[i % projects.length].id,
        materialId: materials[i % materials.length].id,
        requestedById: requesters[i % requesters.length].id,
        approvedById: status === MaterialRequestStatus.PENDING ? null : approvers[i % approvers.length].id,
        quantity: decimal(rand(1, 80)),
        status,
        requestedAt: subDays(new Date(), rand(0, 45)),
        approvedAt: status === MaterialRequestStatus.PENDING ? null : subDays(new Date(), rand(0, 20)),
        note: "Cerere materiale generata pentru demo operational.",
      },
    });
  }

  for (let i = 0; i < 200; i++) {
    const start = subDays(new Date(), rand(0, 45));
    const duration = rand(60, 540);
    await prisma.timeEntry.create({
      data: {
        userId: responsibleUsers[i % responsibleUsers.length].id,
        projectId: projects[i % projects.length].id,
        workOrderId: workOrders[i % workOrders.length].id,
        startAt: start,
        endAt: addDays(start, 0),
        durationMinutes: duration,
        breakMinutes: rand(0, 60),
        overtimeMinutes: rand(0, 120),
        status: [TimeEntryStatus.SUBMITTED, TimeEntryStatus.APPROVED, TimeEntryStatus.DRAFT][i % 3],
        note: "Pontaj teren",
      },
    });
  }

  for (let i = 0; i < 20; i++) {
    await prisma.dailySiteReport.create({
      data: {
        projectId: projects[i % projects.length].id,
        workOrderId: workOrders[i % workOrders.length].id,
        reportDate: subDays(new Date(), i),
        weather: ["Senin", "Ploaie usoara", "Noros", "Vant moderat"][i % 4],
        workersCount: rand(4, 18),
        subcontractorsPresent: i % 2 === 0 ? "Da" : "Nu",
        workCompleted: "S-au finalizat traseele de cablu si montajul aparatajului prevazut.",
        blockers: i % 4 === 0 ? "Intarziere livrare materiale" : null,
        safetyIncidents: i % 8 === 0 ? "Incident minor fara oprire" : null,
        materialsReceived: "Cablu FY si accesorii",
        equipmentUsed: "Platforma foarfeca, tester izolatie",
        signatures: "Sef santier + client",
        photos: ["/demo/foto1.jpg", "/demo/foto2.jpg"],
        createdById: requesters[i % requesters.length].id,
      },
    });
  }

  for (let i = 0; i < 15; i++) {
    const base = decimal(10000 + i * 2200);
    const vat = base.mul(new Prisma.Decimal(0.19));
    const total = base.add(vat);
    const paid = i % 4 === 0 ? total : i % 4 === 1 ? base.div(2) : decimal(0);

    await prisma.invoice.create({
      data: {
        projectId: projects[i % projects.length].id,
        clientId: clients[i % clients.length].id,
        invoiceNumber: `ELT-INV-${2026}${(i + 1).toString().padStart(4, "0")}`,
        issueDate: subDays(new Date(), rand(0, 40)),
        dueDate: addDays(new Date(), rand(-12, 35)),
        baseAmount: base,
        vatRate: decimal(19),
        vatAmount: vat,
        totalAmount: total,
        paidAmount: paid,
        status: [InvoiceStatus.SENT, InvoiceStatus.OVERDUE, InvoiceStatus.PARTIAL_PAID, InvoiceStatus.PAID][i % 4],
      },
    });
  }

  const subcontractors = await createSequential(
    ["MetalStruct Team", "Rapid Instal Systems", "BuildSub Vest"],
    (name, i) =>
      prisma.subcontractor.create({
        data: {
          name,
          cui: `ROSUB${1000 + i}`,
          contactName: `Coordonator ${i + 1}`,
          phone: `0733 000 0${i + 1}`,
          email: `contact${i + 1}@subcontractor.ro`,
          approvalStatus: i === 0 ? SubcontractorApprovalStatus.APROBAT : SubcontractorApprovalStatus.IN_VERIFICARE,
        },
      }),
  );

  for (let i = 0; i < 10; i++) {
    await prisma.subcontractorAssignment.create({
      data: {
        subcontractorId: subcontractors[i % subcontractors.length].id,
        projectId: projects[i % projects.length].id,
        contractRef: `SUB-${i + 100}`,
        startDate: subDays(new Date(), rand(10, 60)),
        endDate: addDays(new Date(), rand(10, 60)),
        status: i % 2 === 0 ? AssignmentStatus.ACTIV : AssignmentStatus.PLANIFICAT,
      },
    });
  }

  for (let i = 0; i < 18; i++) {
    await prisma.equipment.create({
      data: {
        code: `EQ-${(i + 1).toString().padStart(3, "0")}`,
        name: ["Generator", "Platforma ridicare", "Aparat sudura", "Compresor", "Tester izolatie"][i % 5],
        serialNumber: `SN-${9000 + i}`,
        category: "Utilaj",
        status: [EquipmentStatus.AVAILABLE, EquipmentStatus.IN_USE, EquipmentStatus.SERVICE][i % 3],
        maintenanceDueAt: addDays(new Date(), rand(15, 120)),
        qrCode: `https://qr.eltgrup.ro/EQ-${(i + 1).toString().padStart(3, "0")}`,
      },
    });
  }

  for (let i = 0; i < 40; i++) {
    await prisma.costEntry.create({
      data: {
        projectId: projects[i % projects.length].id,
        type: [CostType.LABOR, CostType.MATERIAL, CostType.SUBCONTRACTOR, CostType.EQUIPMENT][i % 4],
        description: "Cost operational inregistrat automat",
        amount: decimal(rand(1500, 15000)),
        occurredAt: subDays(new Date(), rand(0, 60)),
        approvedById: users.find((u) => u.role === RoleKey.ACCOUNTANT)?.id,
      },
    });
  }

  for (let i = 0; i < 40; i++) {
    await prisma.document.create({
      data: {
        projectId: projects[i % projects.length].id,
        category: [DocumentCategory.CONTRACT, DocumentCategory.INVOICE, DocumentCategory.SITE_REPORT, DocumentCategory.PHOTO][i % 4],
        title: `Document proiect #${i + 1}`,
        fileName: `doc-${i + 1}.pdf`,
        mimeType: "application/pdf",
        storagePath: `/documents/demo/doc-${i + 1}.pdf`,
        tags: ["santier", "2026"],
        expiresAt: i % 5 === 0 ? addDays(new Date(), 20) : null,
        uploadedById: users[i % users.length].id,
      },
    });
  }

  for (let i = 0; i < 60; i++) {
    await prisma.notification.create({
      data: {
        userId: users[i % users.length].id,
        type: [
          NotificationType.NEW_ASSIGNMENT,
          NotificationType.OVERDUE_TASK,
          NotificationType.LOW_STOCK,
          NotificationType.TIMESHEET_APPROVAL_REQUIRED,
          NotificationType.INVOICE_OVERDUE,
        ][i % 5],
        title: `Notificare operationala #${i + 1}`,
        message: "Exista un element care necesita atentie in platforma ELTGRUP Manager.",
        isRead: i % 3 === 0,
        actionUrl: "/panou",
      },
    });
  }

  console.log("Seed finalizat: ELTGRUP Manager demo data gata.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
