"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import {
  closestCorners,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { formatDate } from "@/src/lib/utils";
import { updateWorkOrderScheduleAction } from "./actions";

type ConflictReason = "missing_assignment" | "invalid_dates" | "deadline_conflict" | "unavailable_worker" | "overlap";

type Task = {
  id: string;
  title: string;
  project: string;
  team: string;
  teamId: string | null;
  responsibleId: string | null;
  responsible: string | null;
  status: string;
  priority: string;
  day: string;
  startDateIso: string | null;
  dueDateIso: string | null;
};

type TaskIssue = {
  key: ConflictReason;
  label: string;
  detail: string;
  severity: "warning" | "critical";
};

type DayIssueSummary = {
  key: ConflictReason;
  label: string;
  count: number;
  severity: "warning" | "critical";
};

const weekdays = ["Luni", "Marti", "Miercuri", "Joi", "Vineri", "Sambata", "Duminica"];
const conflictOrder: ConflictReason[] = [
  "missing_assignment",
  "invalid_dates",
  "deadline_conflict",
  "unavailable_worker",
  "overlap",
];

const conflictMeta: Record<
  ConflictReason,
  {
    label: string;
    severity: "warning" | "critical";
  }
> = {
  missing_assignment: { label: "Responsabil lipsa", severity: "warning" },
  invalid_dates: { label: "Date invalide", severity: "critical" },
  deadline_conflict: { label: "Termen conflictual", severity: "critical" },
  unavailable_worker: { label: "Responsabil ocupat", severity: "warning" },
  overlap: { label: "Suprapunere echipa", severity: "warning" },
};

function parseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function cardTone(priority: string) {
  if (priority === "CRITICAL") return "border-[#7d3a45] bg-[rgba(98,42,50,0.42)]";
  if (priority === "HIGH") return "border-[#82683c] bg-[rgba(109,84,42,0.3)]";
  return "border-[var(--border)] bg-[rgba(17,29,50,0.9)]";
}

function issueTone(issue: TaskIssue) {
  if (issue.severity === "critical") return "border-[rgba(232,102,120,0.42)] bg-[rgba(105,38,50,0.34)] text-[#ffd7dd]";
  return "border-[rgba(213,170,69,0.4)] bg-[rgba(213,170,69,0.14)] text-[#f4d88d]";
}

function DraggableTaskCard({ task, issues }: { task: Task; issues: TaskIssue[] }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, data: task });
  const hasCriticalIssue = issues.some((issue) => issue.severity === "critical");

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.65 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`touch-none cursor-grab rounded-xl border p-2.5 text-xs shadow-[0_10px_25px_-18px_rgba(0,0,0,0.85)] transition hover:border-[#4e73aa] active:cursor-grabbing ${hasCriticalIssue ? "border-[#8c3d49] bg-[rgba(97,37,48,0.46)]" : cardTone(task.priority)}`}
    >
      <p className="font-semibold text-[var(--foreground)]">{task.title}</p>
      <p className="text-[#a8bbd6]">{task.project}</p>
      <div className="mt-1 space-y-0.5 text-[11px] text-[#90a5c2]">
        <p>{task.team}</p>
        <p>{task.responsible || "Responsabil nealocat"}</p>
        <p>{task.startDateIso ? `Start: ${formatDate(task.startDateIso)}` : "Fara data de start"}</p>
        <p>{task.dueDateIso ? `Termen: ${formatDate(task.dueDateIso)}` : "Fara termen"}</p>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        <span className="rounded-full border border-[rgba(146,166,195,0.22)] bg-[rgba(18,31,53,0.72)] px-2 py-0.5 text-[10px] font-medium text-[#aebed4]">
          {task.status}
        </span>
        {issues.length ? (
          <span className="rounded-full border border-[rgba(213,170,69,0.28)] bg-[rgba(213,170,69,0.14)] px-2 py-0.5 text-[10px] font-medium text-[#f4d88d]">
            {issues.length} avertismente
          </span>
        ) : null}
      </div>
      {issues.length ? (
        <ul className="mt-2 space-y-1">
          {issues.map((issue) => (
            <li key={`${task.id}-${issue.key}`} className={`rounded-lg border px-2 py-1 text-[11px] leading-4 ${issueTone(issue)}`}>
              <span className="font-semibold">{issue.label}</span>
              <span className="ml-1 text-[11px] opacity-90">{issue.detail}</span>
            </li>
          ))}
        </ul>
      ) : null}
      <Link href={`/lucrari/${task.id}`} className="mt-1 inline-block text-[11px] font-semibold text-[#bcd4f7] hover:underline">
        Deschide lucrarea pentru corectie
      </Link>
    </div>
  );
}

function DayColumn({
  day,
  tasks,
  summaries,
  taskIssuesById,
}: {
  day: string;
  tasks: Task[];
  summaries: DayIssueSummary[];
  taskIssuesById: Map<string, TaskIssue[]>;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: day });
  const totalIssues = summaries.reduce((sum, item) => sum + item.count, 0);

  return (
    <div
      ref={setNodeRef}
      className={[
        "min-h-56 rounded-2xl border p-3 transition",
        isOver ? "border-[#4f79ba] bg-[rgba(31,52,86,0.42)]" : totalIssues ? "border-[rgba(213,170,69,0.28)] bg-[rgba(28,22,14,0.78)]" : "border-[var(--border)] bg-[rgba(10,18,33,0.84)]",
      ].join(" ")}
    >
      <div className="mb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#92a6c3]">{day}</p>
            {summaries.length ? (
              <div className="mt-1 flex flex-wrap gap-1">
                {summaries.slice(0, 2).map((summary) => (
                  <span
                    key={summary.key}
                    className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${summary.severity === "critical" ? "border-[rgba(232,102,120,0.35)] bg-[rgba(232,102,120,0.14)] text-[#ffd2da]" : "border-[rgba(213,170,69,0.35)] bg-[rgba(213,170,69,0.14)] text-[#f4d88d]"}`}
                  >
                    {summary.label}
                    {summary.count > 1 ? ` x${summary.count}` : ""}
                  </span>
                ))}
                {summaries.length > 2 ? (
                  <span className="rounded-full border border-[rgba(146,166,195,0.2)] bg-[rgba(18,31,53,0.65)] px-2 py-0.5 text-[10px] font-semibold text-[#aabbd2]">
                    +{summaries.length - 2} altele
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>
          {totalIssues > 0 ? (
            <span className="rounded-full border border-[rgba(213,170,69,0.45)] bg-[rgba(213,170,69,0.16)] px-2 py-0.5 text-[10px] font-semibold text-[#f2cf77]">
              {totalIssues} avertismente
            </span>
          ) : null}
        </div>
      </div>
      <div className="space-y-2">
        {tasks.map((task) => (
          <DraggableTaskCard key={task.id} task={task} issues={taskIssuesById.get(task.id) ?? []} />
        ))}
      </div>
    </div>
  );
}

export function PlanningBoard({ initialTasks }: { initialTasks: Task[] }) {
  const [isPending, startTransition] = useTransition();
  const [tasks, setTasks] = useState(initialTasks);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }));

  const { tasksByDay, taskIssuesById, summariesByDay } = useMemo(() => {
    const grouped = weekdays.reduce<Record<string, Task[]>>((acc, day) => {
      acc[day] = [];
      return acc;
    }, {});
    const issuesByTask = new Map<string, TaskIssue[]>();
    const issueKeysByTask = new Map<string, Set<ConflictReason>>();

    for (const task of tasks) {
      const dayKey = weekdays.includes(task.day) ? task.day : "Luni";
      grouped[dayKey].push(task);
    }

    const addIssue = (task: Task, key: ConflictReason, detail: string) => {
      const issueKeys = issueKeysByTask.get(task.id) ?? new Set<ConflictReason>();
      if (issueKeys.has(key)) return;
      issueKeys.add(key);
      issueKeysByTask.set(task.id, issueKeys);

      const nextIssues = issuesByTask.get(task.id) ?? [];
      nextIssues.push({
        key,
        label: conflictMeta[key].label,
        detail,
        severity: conflictMeta[key].severity,
      });
      issuesByTask.set(task.id, nextIssues);
    };

    for (const task of tasks) {
      const startDate = parseDate(task.startDateIso);
      const dueDate = parseDate(task.dueDateIso);

      if (!startDate || !dueDate) {
        addIssue(task, "invalid_dates", "Data de start sau termenul nu poate fi citita corect.");
      } else if (startDate.getTime() > dueDate.getTime()) {
        addIssue(
          task,
          "deadline_conflict",
          `Termenul ${formatDate(dueDate.toISOString())} este inaintea inceperii planificate ${formatDate(startDate.toISOString())}.`,
        );
      }

      if (!task.responsibleId) {
        addIssue(task, "missing_assignment", "Aloca un responsabil pentru a elimina avertismentul.");
      }
    }

    for (const day of weekdays) {
      const dayTasks = grouped[day];
      const responsibleBuckets = new Map<string, Task[]>();
      const teamBuckets = new Map<string, Task[]>();

      for (const task of dayTasks) {
        if (task.responsibleId) {
          const responsibleTasks = responsibleBuckets.get(task.responsibleId) ?? [];
          responsibleTasks.push(task);
          responsibleBuckets.set(task.responsibleId, responsibleTasks);
        }

        if (task.teamId) {
          const teamTasks = teamBuckets.get(task.teamId) ?? [];
          teamTasks.push(task);
          teamBuckets.set(task.teamId, teamTasks);
        }
      }

      for (const tasksWithSameResponsible of responsibleBuckets.values()) {
        if (tasksWithSameResponsible.length < 2) continue;
        const responsibleLabel = tasksWithSameResponsible[0].responsible || "Responsabilul alocat";
        for (const task of tasksWithSameResponsible) {
          addIssue(task, "unavailable_worker", `${responsibleLabel} are ${tasksWithSameResponsible.length} lucrari programate in ${day}.`);
        }
      }

      for (const tasksWithSameTeam of teamBuckets.values()) {
        if (tasksWithSameTeam.length < 2) continue;
        const teamLabel = tasksWithSameTeam[0].team;
        for (const task of tasksWithSameTeam) {
          addIssue(task, "overlap", `Echipa ${teamLabel} apare in ${tasksWithSameTeam.length} lucrari in ${day}.`);
        }
      }
    }

    const summariesByDay = weekdays.reduce<Record<string, DayIssueSummary[]>>((acc, day) => {
      const counts = new Map<ConflictReason, DayIssueSummary>();

      for (const task of grouped[day]) {
        const issues = issuesByTask.get(task.id) ?? [];
        const seenOnTask = new Set<ConflictReason>();
        for (const issue of issues) {
          if (seenOnTask.has(issue.key)) continue;
          seenOnTask.add(issue.key);
          const current = counts.get(issue.key) ?? {
            key: issue.key,
            label: issue.label,
            count: 0,
            severity: issue.severity,
          };
          current.count += 1;
          counts.set(issue.key, current);
        }
      }

      acc[day] = conflictOrder.map((key) => counts.get(key)).filter((item): item is DayIssueSummary => Boolean(item));
      return acc;
    }, {});

    return { tasksByDay: grouped, taskIssuesById: issuesByTask, summariesByDay };
  }, [tasks]);

  function parseDayToOffset(day: string) {
    const index = weekdays.indexOf(day);
    return index >= 0 ? index : 0;
  }

  async function handleMove(task: Task, targetDay: string) {
    const previousTasks = tasks;
    const now = new Date();
    const start = new Date(now);
    const currentDay = start.getDay();
    const mondayOffset = currentDay === 0 ? -6 : 1 - currentDay;
    start.setDate(start.getDate() + mondayOffset + parseDayToOffset(targetDay));
    start.setHours(8, 0, 0, 0);

    setError(null);
    setTasks((current) => current.map((item) => (item.id === task.id ? { ...item, day: targetDay, startDateIso: start.toISOString() } : item)));

    startTransition(async () => {
      try {
        await updateWorkOrderScheduleAction({
          id: task.id,
          dayLabel: targetDay,
          startDateIso: start.toISOString(),
        });
      } catch {
        setTasks(previousTasks);
        setError("Mutarea nu a fost salvata. Verifica permisiunile sau conexiunea.");
      }
    });
  }

  function onDragEnd(event: DragEndEvent) {
    const task = event.active.data.current as Task | undefined;
    const rawOverId = event.over?.id ? String(event.over.id) : undefined;
    let targetDay = rawOverId;

    if (targetDay && !weekdays.includes(targetDay)) {
      const hoveredTask = tasks.find((item) => item.id === targetDay);
      targetDay = hoveredTask?.day;
    }

    setActiveTaskId(null);

    if (!task || !targetDay || task.day === targetDay) return;
    void handleMove(task, targetDay);
  }

  function onDragStart(event: DragStartEvent) {
    setActiveTaskId(String(event.active.id));
  }

  const activeTask = tasks.find((task) => task.id === activeTaskId) ?? null;

  return (
    <div>
      <div className="mb-3 text-xs text-[var(--muted)]">
        {isPending
          ? "Se salveaza replanificarea..."
          : "Trage o lucrare intre zile pentru a actualiza programul saptamanii. Cardurile cu avertismente explica ce trebuie corectat."}
      </div>
      {error ? <p className="mb-3 text-xs font-medium text-[#ffb7bf]">{error}</p> : null}
      <DndContext collisionDetection={closestCorners} sensors={sensors} onDragEnd={onDragEnd} onDragStart={onDragStart}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          {weekdays.map((day) => (
            <DayColumn
              key={day}
              day={day}
              tasks={tasksByDay[day] ?? []}
              summaries={summariesByDay[day] ?? []}
              taskIssuesById={taskIssuesById}
            />
          ))}
        </div>
        <DragOverlay>{activeTask ? <DraggableTaskCard task={activeTask} issues={taskIssuesById.get(activeTask.id) ?? []} /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}
