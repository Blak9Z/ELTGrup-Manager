import { NotificationType, Prisma } from "@prisma/client";
import Link from "next/link";
import { PermissionGuard } from "@/src/components/auth/permission-guard";
import { Badge } from "@/src/components/ui/badge";
import { Button } from "@/src/components/ui/button";
import { Card } from "@/src/components/ui/card";
import { EmptyState } from "@/src/components/ui/empty-state";
import { Input } from "@/src/components/ui/input";
import { PageHeader } from "@/src/components/ui/page-header";
import { auth } from "@/src/lib/auth";
import { formatDateTime } from "@/src/lib/utils";
import { prisma } from "@/src/lib/prisma";
import { buildListHref, parseEnumParam, parsePositiveIntParam, resolvePagination } from "@/src/lib/query-params";
import { markAllNotificationsRead, markNotificationReadAndOpen } from "./actions";

const notificationTypeLabels: Partial<Record<NotificationType, string>> = {
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

type NotificationSeverity = "critical" | "high" | "normal";

const notificationTypeSeverity: Record<NotificationType, NotificationSeverity> = {
  NEW_ASSIGNMENT: "normal",
  OVERDUE_TASK: "critical",
  LOW_STOCK: "high",
  MISSING_DOCUMENT: "critical",
  DELAYED_PROJECT: "critical",
  TIMESHEET_APPROVAL_REQUIRED: "high",
  MATERIAL_REQUEST_APPROVAL_REQUIRED: "high",
  INVOICE_OVERDUE: "critical",
  COMPLIANCE_DOCUMENT_EXPIRING: "critical",
};

const severityLabels: Record<NotificationSeverity, string> = {
  critical: "Critica",
  high: "Inalta",
  normal: "Normala",
};

const severityTones: Record<NotificationSeverity, "danger" | "warning" | "neutral"> = {
  critical: "danger",
  high: "warning",
  normal: "neutral",
};

const readStateOptions = ["all", "read", "unread"] as const;
type NotificationReadState = (typeof readStateOptions)[number];

const readStateLabels: Record<NotificationReadState, string> = {
  all: "Toate",
  read: "Citite",
  unread: "Necitite",
};

function buildNotificariHref({
  page,
  q,
  readState,
}: {
  page?: number;
  q?: string;
  readState?: NotificationReadState;
}) {
  return buildListHref("/notificari", {
    page,
    q,
    readState: readState && readState !== "all" ? readState : undefined,
  });
}

function getReadStateTone(isRead: boolean) {
  return isRead ? "neutral" : "warning";
}

function getNotificationSeverity(type: NotificationType) {
  return notificationTypeSeverity[type];
}

export default async function NotificariPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string; readState?: string }>;
}) {
  const params = await searchParams;
  const query = params.q?.trim() || "";
  const readState = parseEnumParam(params.readState, readStateOptions) || "all";
  const page = parsePositiveIntParam(params.page);
  const pageSize = 20;
  const session = await auth();
  if (!session?.user?.id) return null;

  const where: Prisma.NotificationWhereInput = { userId: session.user.id };
  const andFilters: Prisma.NotificationWhereInput[] = [];

  if (readState === "read") {
    andFilters.push({ isRead: true });
  } else if (readState === "unread") {
    andFilters.push({ isRead: false });
  }

  if (query) {
    andFilters.push({
      OR: [
        { title: { contains: query, mode: "insensitive" } },
        { message: { contains: query, mode: "insensitive" } },
        { actionUrl: { contains: query, mode: "insensitive" } },
      ],
    });
  }

  const filteredWhere = andFilters.length > 0 ? { ...where, AND: andFilters } : where;
  const totalNotifications = await prisma.notification.count({ where: filteredWhere });
  const { totalPages, currentPage, skip, take } = resolvePagination({
    page,
    totalItems: totalNotifications,
    pageSize,
  });
  const [notifications, unreadCount, typeBreakdown, globalUnreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: filteredWhere,
      orderBy: [{ isRead: "asc" }, { createdAt: "desc" }, { id: "asc" }],
      skip,
      take,
    }),
    prisma.notification.count({
      where: { ...filteredWhere, isRead: false },
    }),
    prisma.notification.groupBy({
      by: ["type"],
      where: filteredWhere,
      _count: { _all: true },
    }),
    prisma.notification.count({
      where: { userId: session.user.id, isRead: false },
    }),
  ]);
  const readCount = totalNotifications - unreadCount;
  const byType = typeBreakdown.reduce<Record<string, number>>((acc, notification) => {
    acc[notification.type] = notification._count._all;
    return acc;
  }, {});
  const hasFilters = Boolean(query || readState !== "all");
  const clearHref = buildNotificariHref({});
  const prevHref = currentPage > 1 ? buildNotificariHref({ page: currentPage - 1, q: query, readState }) : null;
  const nextHref = currentPage < totalPages ? buildNotificariHref({ page: currentPage + 1, q: query, readState }) : null;

  return (
    <PermissionGuard resource="REPORTS" action="VIEW">
      <div className="space-y-6">
        <PageHeader
          title="Notificari"
          subtitle="Inbox operational: aprobari, alerte, schimbari de status si urmarire executie"
          actions={
            globalUnreadCount > 0 ? (
              <form action={markAllNotificationsRead}>
                <Button type="submit" variant="secondary">
                  Marcheaza toate ca citite ({globalUnreadCount})
                </Button>
              </form>
            ) : null
          }
        />

        <Card>
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={unreadCount > 0 ? "warning" : "success"}>
              {unreadCount > 0 ? `${unreadCount} necitite` : "Toate notificarile sunt citite"}
            </Badge>
            <Badge tone="neutral">{totalNotifications} in lista</Badge>
            <Badge tone={readState === "unread" ? "warning" : readState === "read" ? "success" : "info"}>
              {readStateLabels[readState]}
            </Badge>
            {readCount > 0 ? <Badge tone="success">{readCount} citite</Badge> : null}
          </div>
          <form method="get" action="/notificari" className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.6fr)_minmax(220px,0.85fr)_auto]">
            <input type="hidden" name="page" value="1" />
            <Input name="q" defaultValue={query} placeholder="Cauta in titlu, mesaj sau link" />
            <select
              name="readState"
              defaultValue={readState}
              className="h-11 rounded-lg border border-[var(--border)] bg-[var(--surface-card)] px-3 text-sm text-[var(--foreground)]"
            >
              {readStateOptions.map((state) => (
                <option key={state} value={state}>
                  {readStateLabels[state]}
                </option>
              ))}
            </select>
            <div className="flex flex-wrap gap-2">
              <Button type="submit" variant="secondary" className="w-full lg:w-auto">
                Aplica filtre
              </Button>
            </div>
          </form>
          {hasFilters ? (
            <form method="get" action={clearHref} className="mt-3 flex justify-end">
              <Button type="submit" variant="ghost" className="w-full sm:w-auto">
                Reseteaza filtrele
              </Button>
            </form>
          ) : null}
        </Card>

        <Card>
          <div className="flex flex-wrap items-center gap-2">
            {Object.entries(byType).map(([type, count]) => (
              <Badge key={type} tone="neutral">
                {notificationTypeLabels[type as NotificationType] ?? type}: {count}
              </Badge>
            ))}
          </div>
        </Card>

        {notifications.length === 0 ? (
          <EmptyState
            title={hasFilters ? "Nu exista notificari pentru filtrele selectate" : "Nu exista notificari"}
            description={
              hasFilters
                ? "Sterge filtrele sau ajusteaza cautarea pentru a vedea alte notificari."
                : "Notificarile operationale vor aparea aici cand exista schimbari relevante."
            }
          />
        ) : (
          <div className="space-y-3">
            {notifications.map((notification) => (
              <Card key={notification.id} className={notification.isRead ? "opacity-85" : "border-[#4a6785] bg-[#15273b]"}>
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="neutral">{notificationTypeLabels[notification.type] ?? notification.type}</Badge>
                      <Badge tone={severityTones[getNotificationSeverity(notification.type)]}>
                        {severityLabels[getNotificationSeverity(notification.type)]}
                      </Badge>
                      <Badge tone={getReadStateTone(notification.isRead)}>{notification.isRead ? "Citita" : "Necitita"}</Badge>
                    </div>
                    <div>
                      <p className="font-semibold text-[var(--foreground)]">{notification.title}</p>
                      <p className="text-sm text-[var(--muted)]">{notification.message}</p>
                    </div>
                    <p className="text-xs text-[var(--muted)]">{formatDateTime(notification.createdAt)}</p>
                  </div>
                  <form action={markNotificationReadAndOpen}>
                    <input type="hidden" name="id" value={notification.id} />
                    <Button size="sm" type="submit" className="shrink-0">
                      Deschide
                    </Button>
                  </form>
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-4 text-sm text-[var(--muted)]">
          <span>
            Pagina {currentPage} din {totalPages}
          </span>
          <div className="flex gap-2">
            {prevHref ? (
              <Link className="rounded-lg border border-[var(--border)] px-3 py-1.5 hover:border-[var(--border-strong)]" href={prevHref}>
                Anterior
              </Link>
            ) : null}
            {nextHref ? (
              <Link className="rounded-lg border border-[var(--border)] px-3 py-1.5 hover:border-[var(--border-strong)]" href={nextHref}>
                Urmator
              </Link>
            ) : null}
          </div>
        </div>

      </div>
    </PermissionGuard>
  );
}
