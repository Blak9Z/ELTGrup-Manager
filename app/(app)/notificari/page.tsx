import Link from "next/link";
import { auth } from "@/src/lib/auth";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { PageHeader } from "@/src/components/ui/page-header";
import { formatDateTime } from "@/src/lib/utils";
import { prisma } from "@/src/lib/prisma";
import { markAllNotificationsRead, markNotificationRead } from "./actions";

export default async function NotificariPage() {
  const session = await auth();
  const notifications = await prisma.notification.findMany({
    where: { userId: session?.user?.id },
    orderBy: { createdAt: "desc" },
    take: 80,
  });

  const unread = notifications.filter((n) => !n.isRead).length;

  return (
    <PermissionGuard resource="REPORTS" action="VIEW">
      <div className="space-y-6">
        <PageHeader
          title="Notificari"
          subtitle="Atribuiri noi, intarzieri, stoc minim, documente lipsa, aprobari necesare"
          actions={
            <form action={markAllNotificationsRead}>
              <Button type="submit" variant="secondary">Marcheaza toate ca citite ({unread})</Button>
            </form>
          }
        />
        <div className="space-y-2">
          {notifications.map((notification) => (
            <Card key={notification.id} className={notification.isRead ? "opacity-80" : "border-[#bfd9c8]"}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-semibold">{notification.title}</p>
                  <p className="text-sm text-[#9fb3ce]">{notification.message}</p>
                  <p className="mt-1 text-xs text-[#9fb3ce]">{formatDateTime(notification.createdAt)}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {notification.actionUrl ? (
                      <Link href={notification.actionUrl} className="text-xs font-semibold text-[#b9d4ff] hover:underline">
                        Deschide
                      </Link>
                    ) : null}
                    {!notification.isRead ? (
                      <form action={markNotificationRead}>
                        <input type="hidden" name="id" value={notification.id} />
                        <button className="text-xs font-semibold text-[#dce7f9] hover:underline" type="submit">Marcheaza citit</button>
                      </form>
                    ) : null}
                  </div>
                </div>
                <Badge tone={notification.isRead ? "neutral" : "info"}>{notification.type}</Badge>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </PermissionGuard>
  );
}
