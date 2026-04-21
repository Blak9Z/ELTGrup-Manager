import Link from "next/link";
import { auth } from "@/src/lib/auth";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { PageHeader } from "@/src/components/ui/page-header";
import { formatDateTime } from "@/src/lib/utils";
import { prisma } from "@/src/lib/prisma";
import { markAllNotificationsRead, markNotificationReadAndOpen } from "./actions";
import { resolveNotificationTarget } from "@/src/lib/notifications";

const notificationTypeLabels: Partial<Record<string, string>> = {
  NEW_ASSIGNMENT: "Asignare noua",
  OVERDUE_TASK: "Lucrare intarziata",
  LOW_STOCK: "Stoc scazut",
  MISSING_DOCUMENT: "Document lipsa",
  DELAYED_PROJECT: "Proiect intarziat",
  TIMESHEET_APPROVAL_REQUIRED: "Pontaj de aprobat",
  MATERIAL_REQUEST_APPROVAL_REQUIRED: "Cerere materiale",
  INVOICE_OVERDUE: "Factura restante",
  COMPLIANCE_DOCUMENT_EXPIRING: "Document de conformitate",
};

export default async function NotificariPage() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isRead: "asc" }, { createdAt: "desc" }],
    take: 80,
  });

  const unread = notifications.filter((n) => !n.isRead).length;
  const byType = notifications.reduce<Record<string, number>>((acc, notification) => {
    acc[notification.type] = (acc[notification.type] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notificari"
        subtitle="Inbox operational: aprobari, alerte, schimbari de status si urmarire executie"
        actions={
          <form action={markAllNotificationsRead}>
            <Button type="submit" variant="secondary">Marcheaza toate ca citite ({unread})</Button>
          </form>
        }
      />
      <Card>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone={unread > 0 ? "warning" : "success"}>
            {unread > 0 ? `${unread} necitite` : "Toate notificarile sunt citite"}
          </Badge>
          {Object.entries(byType).map(([type, count]) => (
            <Badge key={type} tone="neutral">
              {type}: {count}
            </Badge>
          ))}
        </div>
      </Card>
      <div className="space-y-2">
        {notifications.length === 0 ? (
          <Card>
            <p className="text-sm font-semibold">Nu exista notificari.</p>
            <p className="text-xs text-[var(--muted)]">Notificarile operationale vor aparea aici cand exista schimbari relevante.</p>
          </Card>
        ) : null}
        {notifications.map((notification) => (
          <Card key={notification.id} className={notification.isRead ? "opacity-80" : "border-[#4a6785] bg-[#15273b]"}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-[var(--foreground)]">
                  <Link href={resolveNotificationTarget(notification.type, notification.actionUrl)} className="hover:underline">
                    {notification.title}
                  </Link>
                </p>
                <p className="text-sm text-[var(--muted)]">{notification.message}</p>
                <p className="mt-1 text-xs text-[var(--muted)]">{formatDateTime(notification.createdAt)}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{notificationTypeLabels[notification.type] ?? notification.type}</Badge>
                  <Link
                    href={resolveNotificationTarget(notification.type, notification.actionUrl)}
                    className="text-xs font-semibold text-[#c6d9ee] hover:underline"
                  >
                    Deschide
                  </Link>
                  {!notification.isRead ? (
                    <form action={markNotificationReadAndOpen}>
                      <input type="hidden" name="id" value={notification.id} />
                      <Button size="sm" type="submit" className="h-8 px-3 text-xs">
                        Deschide si marcheaza citit
                      </Button>
                    </form>
                  ) : null}
                </div>
              </div>
              <Badge tone={notification.isRead ? "neutral" : "info"}>{notification.isRead ? "Citita" : "Necitita"}</Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
