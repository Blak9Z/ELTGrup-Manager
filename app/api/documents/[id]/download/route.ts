import { RoleKey } from "@prisma/client";
import { NextResponse } from "next/server";
import { resolveAccessScope } from "@/src/lib/access-scope";
import { requirePermission } from "@/src/lib/permissions";
import { prisma } from "@/src/lib/prisma";
import { readDocumentFile } from "@/src/lib/storage";

export const runtime = "nodejs";

const externalPrivateRestrictedRoles = new Set<RoleKey>([
  RoleKey.CLIENT_VIEWER,
  RoleKey.SUBCONTRACTOR,
]);

function encodeFileName(fileName: string) {
  const clean = fileName.replace(/[\r\n"]/g, "_").trim() || "document";
  const encoded = encodeURIComponent(clean);
  return `filename="${clean}"; filename*=UTF-8''${encoded}`;
}

export async function GET(
  request: Request,
  context: RouteContext<"/api/documents/[id]/download">,
) {
  try {
    const currentUser = await requirePermission("DOCUMENTS", "VIEW");
    const { id } = await context.params;

    const scope = await resolveAccessScope(currentUser);
    const scopedProjectIds = scope.projectIds && scope.projectIds.length > 0 ? scope.projectIds : ["__none__"];

    const document = await prisma.document.findFirst({
      where: {
        id,
        ...(scope.projectIds === null
          ? {}
          : {
              OR: [
                { projectId: { in: scopedProjectIds } },
                { workOrder: { projectId: { in: scopedProjectIds } } },
                { projectId: null, uploadedById: currentUser.id },
              ],
            }),
      },
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        storagePath: true,
        isPrivate: true,
        uploadedById: true,
      },
    });

    if (!document) {
      return NextResponse.json({ error: "Document inexistent." }, { status: 404 });
    }

    const hasExternalRole = currentUser.roleKeys.some((role) =>
      externalPrivateRestrictedRoles.has(role as RoleKey),
    );
    if (document.isPrivate && hasExternalRole && document.uploadedById !== currentUser.id) {
      return NextResponse.json({ error: "Nu ai acces la acest document privat." }, { status: 403 });
    }

    const bytes = await readDocumentFile(document.storagePath);
    const url = new URL(request.url);
    const downloadMode = url.searchParams.get("download") === "1";

    return new NextResponse(bytes, {
      status: 200,
      headers: {
        "Content-Type": document.mimeType || "application/octet-stream",
        "Content-Length": String(bytes.byteLength),
        "Content-Disposition": `${downloadMode ? "attachment" : "inline"}; ${encodeFileName(document.fileName)}`,
        "Cache-Control": "private, no-store",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Eroare la descarcare document";
    const status = /permisiunea|Sesiune invalida|acces/i.test(message) ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
