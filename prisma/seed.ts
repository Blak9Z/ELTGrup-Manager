import {
  ClientType,
  InventoryAssignmentStatus,
  InventoryCondition,
  InventoryItemStatus,
  InventoryItemType,
  InventoryMovementType,
  InvoiceStatus,
  PermissionAction,
  PermissionResource,
  Prisma,
  PrismaClient,
  ProjectStatus,
  ProjectType,
  RoleKey,
  TaskPriority,
  WorkOrderStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";
import { addDays, subDays } from "date-fns";
import { getPermissionLabel, rolePermissionMatrix } from "../src/lib/rbac";
import { evaluateDemoSeedEnvironment } from "../src/lib/seed-safety";

const prisma = new PrismaClient();
type SeedMode = "safe" | "bootstrap" | "demo";

const validSeedModes: ReadonlySet<SeedMode> = new Set<SeedMode>([
  "safe",
  "bootstrap",
  "demo",
]);
const seedMode = parseSeedMode(process.env.SEED_MODE);
const seedPassword = process.env.SEED_PASSWORD?.trim();
const seedDemoConfirm = process.env.SEED_DEMO_CONFIRM?.trim();
const seedBootstrapEmail = process.env.SEED_BOOTSTRAP_EMAIL?.trim();
const seedBootstrapFirstName = process.env.SEED_BOOTSTRAP_FIRST_NAME?.trim();
const seedBootstrapLastName = process.env.SEED_BOOTSTRAP_LAST_NAME?.trim();
const seedBootstrapPassword = process.env.SEED_BOOTSTRAP_PASSWORD?.trim();
const demoSeedEnvironment = evaluateDemoSeedEnvironment({
  nodeEnv: process.env.NODE_ENV,
  vercelEnv: process.env.VERCEL_ENV,
  appEnv: process.env.APP_ENV,
  deployEnv: process.env.DEPLOY_ENV,
});

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

const roleDescriptions: Record<RoleKey, string> = {
  SUPER_ADMIN: "Acces complet la platforma si administrarea tuturor modulelor.",
  ADMINISTRATOR: "Acces complet la platforma pentru administrare operationala.",
  PROJECT_MANAGER: "Coordoneaza proiectele, lucrarile si echipele.",
  SITE_MANAGER: "Coordoneaza santierul, pontajul si executia din teren.",
  BACKOFFICE: "Sprijina operatiunile interne si fluxurile administrative.",
  WORKER: "Executa taskuri, pontaj si activitati de teren.",
  ACCOUNTANT: "Gestioneaza zona financiara si rapoartele asociate.",
  CLIENT_VIEWER: "Vizibilitate limitata pentru clienti si documente.",
  SUBCONTRACTOR: "Vizibilitate limitata pentru colaboratori externi.",
};

const sampleUsers = [
  {
    firstName: "Eduard",
    lastName: "Administrator",
    email: "seed.superadmin@eltgrup.local",
    roleKey: RoleKey.SUPER_ADMIN,
    positionTitle: "Platform owner",
  },
  {
    firstName: "Mihai",
    lastName: "Radu",
    email: "seed.manager@eltgrup.local",
    roleKey: RoleKey.PROJECT_MANAGER,
    positionTitle: "Project manager",
  },
  {
    firstName: "Andrei",
    lastName: "Stoica",
    email: "seed.site@eltgrup.local",
    roleKey: RoleKey.SITE_MANAGER,
    positionTitle: "Sef de santier",
  },
  {
    firstName: "Razvan",
    lastName: "Nistor",
    email: "seed.worker@eltgrup.local",
    roleKey: RoleKey.WORKER,
    positionTitle: "Tehnician electric",
  },
] as const;

const onboardingClientName = "ELTGRUP Onboarding Client SRL";
const onboardingProjectCode = "ONB-2026-001";
const onboardingTeamCode = "TEAM-ONB-001";
const onboardingInvoiceNumber = "ONB-INV-2026-001";
const onboardingWarehouseCode = "DEP-ONB-001";
const onboardingInventoryCategoryCode = "SCULE_ELECTRICE";
const onboardingInventoryLocationCode = "DEP-ONB-A1";
const onboardingInventoryItemCode = "SC-ONB-001";

function decimal(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

function parseSeedMode(rawMode: string | undefined): SeedMode {
  const normalized = (rawMode ?? "safe").trim().toLowerCase();
  if (validSeedModes.has(normalized as SeedMode)) {
    return normalized as SeedMode;
  }

  throw new Error(
    `SEED_MODE invalid (${normalized}). Use "safe", "bootstrap" or "demo".`,
  );
}

function requireSeedValue(
  value: string | undefined,
  variableName: string,
  mode: SeedMode,
): string {
  if (!value) {
    throw new Error(`${variableName} is required in ${mode} mode.`);
  }

  return value;
}

function assertDemoSeedAllowedForEnvironment() {
  if (!demoSeedEnvironment.allowed) {
    const deployEnvText = demoSeedEnvironment.deployEnvs.length
      ? demoSeedEnvironment.deployEnvs.join(",")
      : "unset";
    throw new Error(
      `SEED_MODE=demo is blocked: ${demoSeedEnvironment.reason} (NODE_ENV=${demoSeedEnvironment.nodeEnv || "unset"}, DEPLOY_ENV=${deployEnvText}).`,
    );
  }
}

type RbacState = {
  roles: Map<RoleKey, { id: string }>;
  permissions: Map<string, { id: string }>;
};

type DemoDataState = {
  usersCount: number;
  projectsCount: number;
  workOrdersCount: number;
  taskChecklistItemsCount: number;
  timeEntriesCount: number;
  attendanceCount: number;
  materialsCount: number;
  stockMovementsCount: number;
  materialRequestsCount: number;
  projectMaterialUsageCount: number;
  equipmentCount: number;
  equipmentAssignmentsCount: number;
  documentsCount: number;
  reportsCount: number;
  notificationsCount: number;
  commentsCount: number;
  activityLogsCount: number;
  clientsCount: number;
  teamsCount: number;
  invoicesCount: number;
  costsCount: number;
  warehousesCount: number;
  subcontractorsCount: number;
  subcontractorAssignmentsCount: number;
  inventoryCategoriesCount: number;
  inventoryLocationsCount: number;
  inventoryItemsCount: number;
  inventoryAssignmentsCount: number;
  inventoryMovementsCount: number;
  inventoryInspectionRecordsCount: number;
  projectPhasesCount: number;
  clientContactsCount: number;
};

type BootstrapSeedInput = {
  email: string;
  firstName: string;
  lastName: string;
  password: string;
};

function hasDemoOperationalData(state: DemoDataState): boolean {
  return Object.values(state).some((count) => count > 0);
}

async function refreshRbac(): Promise<RbacState> {
  const roles = new Map<RoleKey, { id: string }>();
  for (const roleKey of Object.values(RoleKey)) {
    const role = await prisma.role.upsert({
      where: { key: roleKey },
      update: {
        label: roleLabels[roleKey],
        description: roleDescriptions[roleKey],
      },
      create: {
        key: roleKey,
        label: roleLabels[roleKey],
        description: roleDescriptions[roleKey],
      },
    });
    roles.set(roleKey, { id: role.id });
  }

  const permissions = new Map<string, { id: string }>();
  for (const resource of Object.values(PermissionResource)) {
    for (const action of Object.values(PermissionAction)) {
      const label = getPermissionLabel(resource, action);
      const existing = await prisma.permission.findFirst({
        where: { resource, action },
      });
      const permission = existing
        ? await prisma.permission.update({
            where: { id: existing.id },
            data: { label },
          })
        : await prisma.permission.create({
            data: { resource, action, label },
          });

      permissions.set(`${resource}:${action}`, { id: permission.id });
    }
  }

  for (const [roleKey, resourcePermissions] of Object.entries(
    rolePermissionMatrix,
  ) as Array<
    [RoleKey, Partial<Record<PermissionResource, PermissionAction[]>>]
  >) {
    const role = roles.get(roleKey);
    if (!role) continue;

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });

    const permissionIds = Object.entries(resourcePermissions).flatMap(
      ([resource, actions]) =>
        (actions || [])
          .map((action) => permissions.get(`${resource}:${action}`)?.id)
          .filter((id): id is string => Boolean(id)),
    );

    if (permissionIds.length) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId: role.id,
          permissionId,
        })),
        skipDuplicates: true,
      });
    }
  }

  return { roles, permissions };
}

async function getDemoDataState(): Promise<DemoDataState> {
  const [
    usersCount,
    projectsCount,
    workOrdersCount,
    taskChecklistItemsCount,
    timeEntriesCount,
    attendanceCount,
    materialsCount,
    stockMovementsCount,
    materialRequestsCount,
    projectMaterialUsageCount,
    equipmentCount,
    equipmentAssignmentsCount,
    documentsCount,
    reportsCount,
    notificationsCount,
    commentsCount,
    activityLogsCount,
    clientsCount,
    teamsCount,
    invoicesCount,
    costsCount,
    warehousesCount,
    subcontractorsCount,
    subcontractorAssignmentsCount,
    inventoryCategoriesCount,
    inventoryLocationsCount,
    inventoryItemsCount,
    inventoryAssignmentsCount,
    inventoryMovementsCount,
    inventoryInspectionRecordsCount,
    projectPhasesCount,
    clientContactsCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.project.count(),
    prisma.workOrder.count(),
    prisma.taskChecklistItem.count(),
    prisma.timeEntry.count(),
    prisma.attendance.count(),
    prisma.material.count(),
    prisma.stockMovement.count(),
    prisma.materialRequest.count(),
    prisma.projectMaterialUsage.count(),
    prisma.equipment.count(),
    prisma.equipmentAssignment.count(),
    prisma.document.count(),
    prisma.dailySiteReport.count(),
    prisma.notification.count(),
    prisma.comment.count(),
    prisma.activityLog.count(),
    prisma.client.count(),
    prisma.team.count(),
    prisma.invoice.count(),
    prisma.costEntry.count(),
    prisma.warehouse.count(),
    prisma.subcontractor.count(),
    prisma.subcontractorAssignment.count(),
    prisma.inventoryCategory.count(),
    prisma.inventoryLocation.count(),
    prisma.inventoryItem.count(),
    prisma.inventoryAssignment.count(),
    prisma.inventoryMovement.count(),
    prisma.inventoryInspectionRecord.count(),
    prisma.projectPhase.count(),
    prisma.clientContact.count(),
  ]);

  return {
    usersCount,
    projectsCount,
    workOrdersCount,
    taskChecklistItemsCount,
    timeEntriesCount,
    attendanceCount,
    materialsCount,
    stockMovementsCount,
    materialRequestsCount,
    projectMaterialUsageCount,
    equipmentCount,
    equipmentAssignmentsCount,
    documentsCount,
    reportsCount,
    notificationsCount,
    commentsCount,
    activityLogsCount,
    clientsCount,
    teamsCount,
    invoicesCount,
    costsCount,
    warehousesCount,
    subcontractorsCount,
    subcontractorAssignmentsCount,
    inventoryCategoriesCount,
    inventoryLocationsCount,
    inventoryItemsCount,
    inventoryAssignmentsCount,
    inventoryMovementsCount,
    inventoryInspectionRecordsCount,
    projectPhasesCount,
    clientContactsCount,
  };
}

async function seedBootstrap(
  roles: RbacState["roles"],
  input: BootstrapSeedInput,
) {
  const superAdminRole = roles.get(RoleKey.SUPER_ADMIN);
  if (!superAdminRole) {
    throw new Error("Rolul SUPER_ADMIN lipseste din RBAC.");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user = await prisma.user.create({
    data: {
      email: input.email,
      firstName: input.firstName,
      lastName: input.lastName,
      passwordHash,
    },
  });

  await prisma.userRole.create({
    data: {
      userId: user.id,
      roleId: superAdminRole.id,
    },
  });

  console.log("Seed bootstrap completed: initial SUPER_ADMIN created.");
}

async function seedDemo(roles: RbacState["roles"], password: string) {
  const passwordHash = await bcrypt.hash(password, 10);

  const usersByKey = new Map<RoleKey, { id: string }>();
  for (const userSeed of sampleUsers) {
    const user = await prisma.user.upsert({
      where: { email: userSeed.email },
      update: {
        firstName: userSeed.firstName,
        lastName: userSeed.lastName,
        passwordHash,
        isActive: true,
        deletedAt: null,
      },
      create: {
        firstName: userSeed.firstName,
        lastName: userSeed.lastName,
        email: userSeed.email,
        passwordHash,
      },
    });

    const role = roles.get(userSeed.roleKey);
    if (!role) continue;

    await prisma.userRole.deleteMany({ where: { userId: user.id } });
    await prisma.userRole.create({
      data: { userId: user.id, roleId: role.id },
    });

    if (userSeed.roleKey === RoleKey.WORKER) {
      await prisma.workerProfile.upsert({
        where: { userId: user.id },
        update: {
          positionTitle: userSeed.positionTitle || "Tehnician electric",
          deletedAt: null,
        },
        create: {
          userId: user.id,
          employeeCode: "EMP-ONB-001",
          positionTitle: userSeed.positionTitle || "Tehnician electric",
          hourlyRate: decimal(48),
          hireDate: subDays(new Date(), 120),
        },
      });
    }

    usersByKey.set(userSeed.roleKey, { id: user.id });
  }

  const siteManager = usersByKey.get(RoleKey.SITE_MANAGER);
  const projectManager = usersByKey.get(RoleKey.PROJECT_MANAGER);
  const worker = usersByKey.get(RoleKey.WORKER);

  if (!siteManager || !projectManager || !worker) {
    throw new Error(
      "Seedul minimal necesita utilizatori pentru PROJECT_MANAGER, SITE_MANAGER si WORKER.",
    );
  }

  const team = await prisma.team.upsert({
    where: { code: onboardingTeamCode },
    update: {
      name: "Echipa onboarding",
      region: "Bucuresti",
      leadUserId: siteManager.id,
      isActive: true,
      deletedAt: null,
    },
    create: {
      code: onboardingTeamCode,
      name: "Echipa onboarding",
      region: "Bucuresti",
      leadUserId: siteManager.id,
    },
  });

  const client = await prisma.client.findFirst({
    where: { name: onboardingClientName },
  });
  const onboardingClient = client
    ? await prisma.client.update({
        where: { id: client.id },
        data: {
          type: ClientType.COMPANY,
          name: onboardingClientName,
          cui: "RO99999999",
          registrationNumber: "J00/000/2026",
          vatCode: "RO19",
          phone: "021 000 0000",
          email: "onboarding@eltgrup.local",
          billingAddress: "Bd. Onboarding 1, Bucuresti",
          notes: "Minimal onboarding sample client.",
        },
      })
    : await prisma.client.create({
        data: {
          type: ClientType.COMPANY,
          name: onboardingClientName,
          cui: "RO99999999",
          registrationNumber: "J00/000/2026",
          vatCode: "RO19",
          phone: "021 000 0000",
          email: "onboarding@eltgrup.local",
          billingAddress: "Bd. Onboarding 1, Bucuresti",
          notes: "Minimal onboarding sample client.",
        },
      });

  await prisma.clientContact.deleteMany({
    where: { clientId: onboardingClient.id },
  });
  await prisma.clientContact.create({
    data: {
      clientId: onboardingClient.id,
      fullName: "Contact onboarding",
      roleTitle: "Manager tehnic",
      email: "contact@eltgrup.local",
      phone: "0720 000 000",
      isPrimary: true,
    },
  });

  const project = await prisma.project.upsert({
    where: { code: onboardingProjectCode },
    update: {
      title: "Proiect onboarding - instalatie electrica",
      description:
        "Proiect minimal pentru onboarding, cu date reale de lucru si un singur flux operational.",
      status: ProjectStatus.ACTIVE,
      type: ProjectType.COMMERCIAL,
      siteAddress: "Bd. Onboarding 1, Bucuresti",
      siteLatitude: new Prisma.Decimal("44.4268"),
      siteLongitude: new Prisma.Decimal("26.1025"),
      contractValue: decimal(125000),
      estimatedBudget: decimal(98000),
      progressPercent: 32,
      startDate: subDays(new Date(), 14),
      endDate: addDays(new Date(), 60),
      managerId: projectManager.id,
      clientId: onboardingClient.id,
      internalNotes: "Date minimal de onboarding, fara volum demo artificial.",
      riskIssuesLog: "Livrare partiala de materiale in etapa initiala.",
    },
    create: {
      code: onboardingProjectCode,
      title: "Proiect onboarding - instalatie electrica",
      description:
        "Proiect minimal pentru onboarding, cu date reale de lucru si un singur flux operational.",
      status: ProjectStatus.ACTIVE,
      type: ProjectType.COMMERCIAL,
      siteAddress: "Bd. Onboarding 1, Bucuresti",
      siteLatitude: new Prisma.Decimal("44.4268"),
      siteLongitude: new Prisma.Decimal("26.1025"),
      contractValue: decimal(125000),
      estimatedBudget: decimal(98000),
      progressPercent: 32,
      startDate: subDays(new Date(), 14),
      endDate: addDays(new Date(), 60),
      managerId: projectManager.id,
      clientId: onboardingClient.id,
      internalNotes: "Date minimal de onboarding, fara volum demo artificial.",
      riskIssuesLog: "Livrare partiala de materiale in etapa initiala.",
    },
  });

  await prisma.projectPhase.deleteMany({ where: { projectId: project.id } });
  await prisma.projectPhase.createMany({
    data: [
      { projectId: project.id, title: "Pregatire santier", position: 1 },
      { projectId: project.id, title: "Executie lucrari", position: 2 },
      { projectId: project.id, title: "Teste si receptie", position: 3 },
    ],
  });
  const firstPhase = await prisma.projectPhase.findFirst({
    where: { projectId: project.id },
    orderBy: { position: "asc" },
  });
  if (!firstPhase) {
    throw new Error("Nu am putut crea fazele proiectului de onboarding.");
  }

  await prisma.workOrder.deleteMany({ where: { projectId: project.id } });
  await prisma.workOrder.create({
    data: {
      projectId: project.id,
      phaseId: firstPhase.id,
      title: "Montaj prize si iluminat",
      description:
        "Lucrare unica de onboarding, cu checklist minim si responsabil clar.",
      siteLocation: "Zona A",
      responsibleId: worker.id,
      teamId: team.id,
      startDate: subDays(new Date(), 3),
      dueDate: addDays(new Date(), 5),
      estimatedHours: decimal(16),
      actualHours: decimal(6),
      status: WorkOrderStatus.IN_PROGRESS,
      priority: TaskPriority.HIGH,
      approvalRequired: true,
      checklistItems: {
        create: [
          { label: "Verificare echipament" },
          { label: "Executie lucrare" },
          { label: "Foto final + semnatura" },
        ],
      },
    },
  });

  await prisma.invoice.upsert({
    where: { invoiceNumber: onboardingInvoiceNumber },
    update: {
      projectId: project.id,
      clientId: onboardingClient.id,
      issueDate: subDays(new Date(), 7),
      dueDate: addDays(new Date(), 21),
      baseAmount: decimal(18000),
      vatRate: decimal(19),
      vatAmount: decimal(3420),
      totalAmount: decimal(21420),
      paidAmount: decimal(0),
      status: InvoiceStatus.SENT,
    },
    create: {
      projectId: project.id,
      clientId: onboardingClient.id,
      invoiceNumber: onboardingInvoiceNumber,
      issueDate: subDays(new Date(), 7),
      dueDate: addDays(new Date(), 21),
      baseAmount: decimal(18000),
      vatRate: decimal(19),
      vatAmount: decimal(3420),
      totalAmount: decimal(21420),
      paidAmount: decimal(0),
      status: InvoiceStatus.SENT,
    },
  });

  const warehouse = await prisma.warehouse.upsert({
    where: { code: onboardingWarehouseCode },
    update: {
      name: "Depozit onboarding",
      address: "Bd. Onboarding 1, Bucuresti",
      managerName: "Responsabil depozit onboarding",
      deletedAt: null,
    },
    create: {
      code: onboardingWarehouseCode,
      name: "Depozit onboarding",
      address: "Bd. Onboarding 1, Bucuresti",
      managerName: "Responsabil depozit onboarding",
    },
  });

  const inventoryCategory = await prisma.inventoryCategory.upsert({
    where: { code: onboardingInventoryCategoryCode },
    update: {
      name: "Scule electrice",
      description: "Categorie minima pentru onboarding.",
      isActive: true,
    },
    create: {
      code: onboardingInventoryCategoryCode,
      name: "Scule electrice",
      description: "Categorie minima pentru onboarding.",
      isActive: true,
    },
  });

  const inventoryLocation = await prisma.inventoryLocation.upsert({
    where: { code: onboardingInventoryLocationCode },
    update: {
      warehouseId: warehouse.id,
      name: "Zona A / Raft 1",
      zone: "Zona A",
      shelf: "Raft 1",
      isActive: true,
    },
    create: {
      code: onboardingInventoryLocationCode,
      warehouseId: warehouse.id,
      name: "Zona A / Raft 1",
      zone: "Zona A",
      shelf: "Raft 1",
      notes: "Locatie minima onboarding pentru modulul gestiune scule.",
      isActive: true,
    },
  });

  const inventoryItem = await prisma.inventoryItem.upsert({
    where: { internalCode: onboardingInventoryItemCode },
    update: {
      name: "Rotopercutor onboarding",
      itemType: InventoryItemType.TOOL,
      categoryId: inventoryCategory.id,
      warehouseId: warehouse.id,
      locationId: inventoryLocation.id,
      serialNumber: "ONB-RP-0001",
      brand: "Bosch",
      model: "GBH 2-26",
      unitOfMeasure: "buc",
      quantityTotal: decimal(2),
      quantityAvailable: decimal(1),
      minimumStock: decimal(1),
      status: InventoryItemStatus.ASSIGNED,
      purchaseDate: subDays(new Date(), 60),
      nextInspectionDate: addDays(new Date(), 30),
      notes: "Articol minim onboarding pentru flux predare/retur.",
      requiresReturn: true,
      createdById: usersByKey.get(RoleKey.SUPER_ADMIN)?.id,
      deletedAt: null,
    },
    create: {
      name: "Rotopercutor onboarding",
      itemType: InventoryItemType.TOOL,
      categoryId: inventoryCategory.id,
      warehouseId: warehouse.id,
      locationId: inventoryLocation.id,
      internalCode: onboardingInventoryItemCode,
      serialNumber: "ONB-RP-0001",
      brand: "Bosch",
      model: "GBH 2-26",
      unitOfMeasure: "buc",
      quantityTotal: decimal(2),
      quantityAvailable: decimal(1),
      minimumStock: decimal(1),
      status: InventoryItemStatus.ASSIGNED,
      purchaseDate: subDays(new Date(), 60),
      nextInspectionDate: addDays(new Date(), 30),
      notes: "Articol minim onboarding pentru flux predare/retur.",
      requiresReturn: true,
      createdById: usersByKey.get(RoleKey.SUPER_ADMIN)?.id,
    },
  });

  await prisma.inventoryMovement.deleteMany({
    where: { itemId: inventoryItem.id },
  });
  await prisma.inventoryAssignment.deleteMany({
    where: { itemId: inventoryItem.id },
  });
  await prisma.inventoryInspectionRecord.deleteMany({
    where: { itemId: inventoryItem.id },
  });

  const assignment = await prisma.inventoryAssignment.create({
    data: {
      itemId: inventoryItem.id,
      projectId: project.id,
      issuedToUserId: worker.id,
      issuedById: siteManager.id,
      quantity: decimal(1),
      issuedAt: subDays(new Date(), 1),
      expectedReturnAt: addDays(new Date(), 7),
      conditionAtIssue: InventoryCondition.GOOD,
      status: InventoryAssignmentStatus.ACTIVE,
      notes: "Alocare minima onboarding pe proiect.",
    },
  });

  await prisma.inventoryMovement.createMany({
    data: [
      {
        itemId: inventoryItem.id,
        warehouseId: warehouse.id,
        type: InventoryMovementType.INITIAL,
        quantity: decimal(2),
        reason: "Stoc initial onboarding",
        notes: "Date minime onboarding",
        performedById: siteManager.id,
        toLocationId: inventoryLocation.id,
        movedAt: subDays(new Date(), 2),
      },
      {
        itemId: inventoryItem.id,
        assignmentId: assignment.id,
        warehouseId: warehouse.id,
        projectId: project.id,
        type: InventoryMovementType.ISSUE,
        quantity: decimal(1),
        reason: "Predare onboarding",
        notes: "Predare catre tehnician in proiect",
        performedById: siteManager.id,
        fromLocationId: inventoryLocation.id,
        movedAt: subDays(new Date(), 1),
      },
    ],
  });

  console.log(
    "Seed finalizat: au fost reimprospatate doar datele minimale de onboarding.",
  );
}

async function main() {
  if (seedMode === "demo") {
    assertDemoSeedAllowedForEnvironment();

    const demoPassword = requireSeedValue(
      seedPassword,
      "SEED_PASSWORD",
      "demo",
    );
    if (seedDemoConfirm !== "RUN_DEMO_SEED") {
      throw new Error(
        'SEED_DEMO_CONFIRM must be set to "RUN_DEMO_SEED" for demo mode.',
      );
    }

    const demoDataState = await getDemoDataState();
    if (hasDemoOperationalData(demoDataState)) {
      throw new Error(
        "Seed demo mode refused: operational data already exists. Use demo only on a fresh empty database.",
      );
    }

    const rbacState = await refreshRbac();
    await seedDemo(rbacState.roles, demoPassword);
    return;
  }

  if (seedMode === "bootstrap") {
    const usersCount = await prisma.user.count();

    if (usersCount > 0) {
      await refreshRbac();
      console.log("Seed skipped in bootstrap mode: existing users detected.");
      return;
    }

    const bootstrapInput: BootstrapSeedInput = {
      email: requireSeedValue(
        seedBootstrapEmail,
        "SEED_BOOTSTRAP_EMAIL",
        "bootstrap",
      ),
      firstName: requireSeedValue(
        seedBootstrapFirstName,
        "SEED_BOOTSTRAP_FIRST_NAME",
        "bootstrap",
      ),
      lastName: requireSeedValue(
        seedBootstrapLastName,
        "SEED_BOOTSTRAP_LAST_NAME",
        "bootstrap",
      ),
      password: requireSeedValue(
        seedBootstrapPassword,
        "SEED_BOOTSTRAP_PASSWORD",
        "bootstrap",
      ),
    };

    const rbacState = await refreshRbac();
    await seedBootstrap(rbacState.roles, bootstrapInput);
    return;
  }

  await refreshRbac();
  console.log(
    "Seed safe mode completed: RBAC metadata refreshed only, demo data not touched.",
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
