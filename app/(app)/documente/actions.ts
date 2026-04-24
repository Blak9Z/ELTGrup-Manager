"use server";

import { DocumentCategory, RoleKey } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { assertClientAccess, assertProjectAccess, assertWorkOrderAccess, resolveAccessScope } from "@/src/lib/access-scope";
import { logActivity } from "@/src/lib/activity-log";
import { ActionState } from "@/src/lib/action-state";
import { requirePermission } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";
import { uploadDocumentFile } from "@/src/lib/storage";

const createDocumentSchema = z.object({
  title: z.string().trim().min(3, "Titlul trebuie sa aiba minim 3 caractere"),
  category: z.nativeEnum(DocumentCategory),
  projectId: z.string().cuid().optional(),
  clientId: z.string().cuid().optional(),
  workOrderId: z.string().cuid().optional(),
  tags: z.string().optional(),
  expiresAt: z.string().optional(),
  isPrivate: z.enum(["true", "false"]).transform((value) => value === "true").optional(),
});

function normalizeTags(tags: string) {
  return Array.from(
    new Set(
      tags
        .split(",")
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

async function assertActiveProjectAccess(user: Awaited<ReturnType<typeof requirePermission>>, projectId: string) {
  await assertProjectAccess(user, projectId);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { deletedAt: true },
  });

  if (!project || project.deletedAt) {
    throw new Error("Proiect inexistent sau deja arhivat.");
  }
}

async function loadActiveWorkOrder(
  user: Awaited<ReturnType<typeof requirePermission>>,
  workOrderId: string,
  options?: { projectId?: string },
) {
  await assertWorkOrderAccess(user, workOrderId, options);

  const workOrder = await prisma.workOrder.findUnique({
    where: { id: workOrderId },
    select: { deletedAt: true, projectId: true },
  });

  if (!workOrder || workOrder.deletedAt) {
    throw new Error("Lucrare inexistenta sau deja arhivata.");
  }

  if (options?.projectId && workOrder.projectId !== options.projectId) {
    throw new Error("Lucrarea selectata nu apartine proiectului selectat.");
  }

  return workOrder;
}

export async function createDocumentAction(_: ActionState, formData: FormData): Promise<ActionState> {
  try {
    const currentUser = await requirePermission("DOCUMENTS", "CREATE");

    const parsed = createDocumentSchema.safeParse({
      title: formData.get("title"),
      category: formData.get("category"),
      projectId: formData.get("projectId") || undefined,
      clientId: formData.get("clientId") || undefined,
      workOrderId: formData.get("workOrderId") || undefined,
      tags: formData.get("tags") || undefined,
      expiresAt: formData.get("expiresAt") || undefined,
      isPrivate: formData.get("isPrivate") || undefined,
    });

    if (!parsed.success) {
      return {
        ok: false,
        message: "Date document invalide",
        errors: parsed.error.flatten().fieldErrors,
      };
    }
    if (parsed.data.projectId) {
      await assertActiveProjectAccess(currentUser, parsed.data.projectId);
    }
    if (parsed.data.clientId) {
      await assertClientAccess(currentUser, parsed.data.clientId);
    }
    let effectiveProjectId = parsed.data.projectId;
    if (parsed.data.workOrderId) {
      const workOrder = await loadActiveWorkOrder(currentUser, parsed.data.workOrderId, { projectId: parsed.data.projectId });
      effectiveProjectId = workOrder.projectId;
    }

    if (effectiveProjectId) {
      const project = await prisma.project.findUnique({
        where: { id: effectiveProjectId },
        select: { deletedAt: true },
      });
      if (!project || project.deletedAt) {
        return { ok: false, message: "Nu poti incarca documente pe un proiect arhivat sau inexistent." };
      }
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { ok: false, message: "Fisierul este obligatoriu", errors: { file: ["Fisier lipsa"] } };
    }

    const uploaded = await uploadDocumentFile(file);

    const created = await prisma.document.create({
      data: {
        title: parsed.data.title,
        category: parsed.data.category,
        fileName: uploaded.fileName,
        storagePath: uploaded.storagePath,
        mimeType: uploaded.mimeType,
        projectId: effectiveProjectId,
        clientId: parsed.data.clientId,
        workOrderId: parsed.data.workOrderId,
        uploadedById: currentUser.id,
        tags: parsed.data.tags ? normalizeTags(parsed.data.tags) : [],
        expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
        isPrivate: parsed.data.isPrivate ?? true,
      },
    });

    await logActivity({
      userId: currentUser.id,
      entityType: "DOCUMENT",
      entityId: created.id,
      action: "DOCUMENT_CREATED",
      diff: {
        title: created.title,
        category: created.category,
        storagePath: created.storagePath,
        projectId: created.projectId,
        workOrderId: created.workOrderId,
        clientId: created.clientId,
      },
    });

    revalidatePath("/documente");
    revalidatePath("/proiecte");
    revalidatePath("/lucrari");
    if (created.projectId) {
      revalidatePath(`/proiecte/${created.projectId}`);
    }
    if (created.workOrderId) {
      revalidatePath(`/lucrari/${created.workOrderId}`);
    }

    return { ok: true, message: "Document salvat cu succes." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Eroare la salvare document" };
  }
}

const bulkDocumentSchema = z.object({
  operation: z.enum(["MAKE_PRIVATE", "MAKE_PUBLIC", "DELETE"]),
  ids: z.array(z.string().cuid()).min(1),
});

export async function bulkDocumentsAction(formData: FormData) {
  const operation = String(formData.get("operation") || "");
  const ids = formData.getAll("ids").map(String).filter(Boolean);
  const parsed = bulkDocumentSchema.safeParse({ operation, ids });
  if (!parsed.success) throw new Error("Selectie bulk invalida pentru documente.");

  const actor =
    parsed.data.operation === "DELETE"
      ? await requirePermission("DOCUMENTS", "DELETE")
      : await requirePermission("DOCUMENTS", "UPDATE");
  const scope = await resolveAccessScope(actor);
  const hasExternalRole = actor.roleKeys.some(
    (role) => role === RoleKey.CLIENT_VIEWER || role === RoleKey.SUBCONTRACTOR,
  );
  const scopedProjectIds = scope.projectIds && scope.projectIds.length > 0 ? scope.projectIds : ["__none__"];
  let scopedIds = parsed.data.ids;
  if (scope.projectIds !== null) {
    const allowed = await prisma.document.findMany({
      where: {
        id: { in: parsed.data.ids },
        OR: [
          { projectId: { in: scopedProjectIds } },
          { workOrder: { projectId: { in: scopedProjectIds } } },
          { projectId: null, uploadedById: actor.id },
        ],
        ...(hasExternalRole ? { isPrivate: false } : {}),
      },
      select: { id: true },
    });
    const allowedSet = new Set(allowed.map((row) => row.id));
    scopedIds = parsed.data.ids.filter((id) => allowedSet.has(id));
  }
  if (scopedIds.length === 0) throw new Error("Nu ai acces la documentele selectate.");

  const affectedContexts = await prisma.document.findMany({
    where: { id: { in: scopedIds } },
    select: {
      projectId: true,
      workOrderId: true,
      workOrder: { select: { projectId: true } },
    },
  });
  const touchedProjectIds = new Set<string>();
  const touchedWorkOrderIds = new Set<string>();
  for (const document of affectedContexts) {
    if (document.projectId) touchedProjectIds.add(document.projectId);
    if (document.workOrderId) touchedWorkOrderIds.add(document.workOrderId);
    if (document.workOrder?.projectId) touchedProjectIds.add(document.workOrder.projectId);
  }

  if (parsed.data.operation === "DELETE") {
    const result = await prisma.document.deleteMany({
      where: { id: { in: scopedIds } },
    });
    await logActivity({
      userId: actor.id,
      entityType: "DOCUMENT_BULK",
      entityId: "MULTI",
      action: "DOCUMENTS_DELETED_BULK",
      diff: { ids: scopedIds, affectedRows: result.count },
    });
  } else {
    const isPrivate = parsed.data.operation === "MAKE_PRIVATE";
    const result = await prisma.document.updateMany({
      where: { id: { in: scopedIds } },
      data: { isPrivate },
    });
    await logActivity({
      userId: actor.id,
      entityType: "DOCUMENT_BULK",
      entityId: "MULTI",
      action: isPrivate ? "DOCUMENTS_MARKED_PRIVATE_BULK" : "DOCUMENTS_MARKED_PUBLIC_BULK",
      diff: { ids: scopedIds, affectedRows: result.count },
    });
  }

  revalidatePath("/documente");
  revalidatePath("/proiecte");
  revalidatePath("/lucrari");
  for (const projectId of touchedProjectIds) {
    revalidatePath(`/proiecte/${projectId}`);
  }
  for (const workOrderId of touchedWorkOrderIds) {
    revalidatePath(`/lucrari/${workOrderId}`);
  }
}
