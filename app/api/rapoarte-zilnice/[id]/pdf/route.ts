import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { NextResponse } from "next/server";
import { auth } from "@/src/lib/auth";
import { assertProjectAccess } from "@/src/lib/access-scope";
import { hasPermission } from "@/src/lib/rbac";
import { prisma } from "@/src/lib/prisma";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const roleKeys = session?.user?.roleKeys || [];
  if (!session?.user?.id || !hasPermission(roleKeys, "REPORTS", "VIEW", session?.user?.email)) {
    return NextResponse.json({ error: "Neautorizat" }, { status: 401 });
  }

  const { id } = await params;
  const report = await prisma.dailySiteReport.findUnique({
    where: { id },
    include: { project: true, workOrder: true },
  });

  if (!report) {
    return NextResponse.json({ error: "Raport inexistent" }, { status: 404 });
  }
  try {
    await assertProjectAccess(
      {
        id: session.user.id,
        email: session.user.email,
        roleKeys: session.user.roleKeys || [],
      },
      report.projectId,
    );
  } catch {
    return NextResponse.json({ error: "Neautorizat" }, { status: 403 });
  }

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([595, 842]);
  const font = await pdf.embedFont(StandardFonts.Helvetica);

  page.drawText("ELTGRUP Manager - Raport zilnic santier", {
    x: 40,
    y: 800,
    size: 16,
    font,
    color: rgb(0.07, 0.36, 0.22),
  });

  const lines = [
    `Proiect: ${report.project.title}`,
    `Data raport: ${new Date(report.reportDate).toLocaleDateString("ro-RO")}`,
    `Vreme: ${report.weather || "-"}`,
    `Numar muncitori: ${report.workersCount}`,
    `Subcontractori prezenti: ${report.subcontractorsPresent || "-"}`,
    `Lucrari executate: ${report.workCompleted}`,
    `Blocaje: ${report.blockers || "-"}`,
    `Incidente SSM: ${report.safetyIncidents || "-"}`,
    `Materiale primite: ${report.materialsReceived || "-"}`,
    `Echipamente utilizate: ${report.equipmentUsed || "-"}`,
    `Semnaturi: ${report.signatures || "-"}`,
  ];

  let y = 760;
  for (const line of lines) {
    page.drawText(line.slice(0, 110), { x: 40, y, size: 11, font, color: rgb(0.1, 0.15, 0.12) });
    y -= 24;
  }

  const bytes = await pdf.save();

  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=raport-zilnic-${id}.pdf`,
    },
  });
}
