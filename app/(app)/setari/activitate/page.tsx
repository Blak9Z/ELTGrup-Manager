import { prisma } from "@/src/lib/prisma";
import { auth } from "@/src/lib/auth";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { PageHeader } from "@/src/components/ui/page-header";
import { Card } from "@/src/components/ui/card";
import { TH, TD, Table } from "@/src/components/ui/table";
import { formatDate } from "@/src/lib/utils";
import { Badge } from "@/src/components/ui/badge";

export default async function AuditLogPage() {
  const logs = await prisma.activityLog.findMany({
    include: {
      user: {
        select: {
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
    take: 100,
  });

  return (
    <PermissionGuard resource="SETTINGS" action="VIEW">
      <div className="space-y-6">
        <PageHeader 
          title="Jurnal de Activitate" 
          subtitle="Istoricul complet al acțiunilor efectuate în sistem pentru audit și securitate." 
        />

        <Card>
          <div className="overflow-x-auto rounded-xl border border-[var(--border)]/70 bg-[var(--surface-card)]">
            <Table>
              <thead>
                <tr>
                  <TH>DATĂ</TH>
                  <TH>UTILIZATOR</TH>
                  <TH>ENTITATE</TH>
                  <TH>ACȚIUNE</TH>
                  <TH>DETALII (DIFF)</TH>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id}>
                    <TD className="whitespace-nowrap text-xs">
                      {new Intl.DateTimeFormat("ro-RO", {
                        dateStyle: "short",
                        timeStyle: "short",
                      }).format(log.createdAt)}
                    </TD>
                    <TD>
                      {log.user 
                        ? `${log.user.firstName} ${log.user.lastName}` 
                        : "Sistem / Anonim"}
                    </TD>
                    <TD>
                      <Badge tone="neutral" className="font-mono text-[10px]">
                        {log.entityType}
                      </Badge>
                      <p className="mt-1 text-[10px] text-[var(--muted)]">{log.entityId}</p>
                    </TD>
                    <TD className="font-semibold text-xs">
                      {log.action.replace(/_/g, " ")}
                    </TD>
                    <TD>
                      {log.diff ? (
                        <pre className="max-w-xs overflow-hidden text-ellipsis whitespace-pre-wrap text-[10px] text-[var(--muted)]">
                          {JSON.stringify(log.diff, null, 2)}
                        </pre>
                      ) : (
                        <span className="text-[10px] text-[var(--muted)]">-</span>
                      )}
                    </TD>
                  </tr>
                ))}
              </tbody>
            </Table>
          </div>
        </Card>
      </div>
    </PermissionGuard>
  );
}
