"use server";

import { ChecklistCategory, Prisma, RoleKey } from "@prisma/client";
import { auth } from "@/src/lib/auth";
import { prisma } from "@/src/lib/prisma";
import { defaultChecklistTemplates } from "@/src/lib/checklist-templates";

async function requireAdmin() {
  const session = await auth();
  const roleKeys = (session?.user?.roleKeys || []) as RoleKey[];
  if (!roleKeys.includes(RoleKey.SUPER_ADMIN) && !roleKeys.includes(RoleKey.ADMINISTRATOR)) {
    throw new Error("Nu aveti permisiunea de a accesa aceasta resursa.");
  }
  return session;
}

async function ensureChecklistTemplates() {
  const existing = await prisma.checklistTemplate.count();
  if (existing > 0) return existing;

  const data: Prisma.ChecklistTemplateCreateManyInput[] = defaultChecklistTemplates.map((template, index) => ({
    name: template.name,
    category: template.category,
    items: template.items,
    projectType: template.projectType,
    sortOrder: index,
  }));

  const result = await prisma.checklistTemplate.createMany({ data, skipDuplicates: true });
  return result.count;
}

export async function seedChecklistTemplates() {
  await requireAdmin();

  const existing = await prisma.checklistTemplate.count();
  if (existing > 0) return { count: existing, seeded: false };

  const count = await ensureChecklistTemplates();
  return { count, seeded: true };
}

export async function getChecklistTemplates(category?: ChecklistCategory) {
  await ensureChecklistTemplates();

  return prisma.checklistTemplate.findMany({
    where: category ? { category } : undefined,
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, category: true, items: true },
  });
}
