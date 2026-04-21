import {
  ClientType,
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

const prisma = new PrismaClient();
const seedPassword = process.env.SEED_PASSWORD || "eltgrup";

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

function decimal(value: number) {
  return new Prisma.Decimal(value.toFixed(2));
}

async function main() {
  const passwordHash = await bcrypt.hash(seedPassword, 10);

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
      const existing = await prisma.permission.findFirst({ where: { resource, action } });
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

  for (const [roleKey, resourcePermissions] of Object.entries(rolePermissionMatrix) as Array<
    [RoleKey, Partial<Record<PermissionResource, PermissionAction[]>>]
  >) {
    const role = roles.get(roleKey);
    if (!role) continue;

    await prisma.rolePermission.deleteMany({ where: { roleId: role.id } });

    const permissionIds = Object.entries(resourcePermissions).flatMap(([resource, actions]) =>
      (actions || []).map((action) => permissions.get(`${resource}:${action}`)?.id).filter((id): id is string => Boolean(id)),
    );

    if (permissionIds.length) {
      await prisma.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId: role.id, permissionId })),
        skipDuplicates: true,
      });
    }
  }

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
    await prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });

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
    throw new Error("Seedul minimal necesita utilizatori pentru PROJECT_MANAGER, SITE_MANAGER si WORKER.");
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

  const client = await prisma.client.findFirst({ where: { name: onboardingClientName } });
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

  await prisma.clientContact.deleteMany({ where: { clientId: onboardingClient.id } });
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
      description: "Proiect minimal pentru onboarding, cu date reale de lucru si un singur flux operational.",
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
      description: "Proiect minimal pentru onboarding, cu date reale de lucru si un singur flux operational.",
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
  const firstPhase = await prisma.projectPhase.findFirst({ where: { projectId: project.id }, orderBy: { position: "asc" } });
  if (!firstPhase) {
    throw new Error("Nu am putut crea fazele proiectului de onboarding.");
  }

  await prisma.workOrder.deleteMany({ where: { projectId: project.id } });
  await prisma.workOrder.create({
    data: {
      projectId: project.id,
      phaseId: firstPhase.id,
      title: "Montaj prize si iluminat",
      description: "Lucrare unica de onboarding, cu checklist minim si responsabil clar.",
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

  console.log("Seed finalizat: au fost reimprospatate doar datele minimale de onboarding.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
