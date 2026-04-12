"use client";

import { CSS } from "@dnd-kit/utilities";
import { DndContext, DragEndEvent, useDraggable, useDroppable } from "@dnd-kit/core";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { rescheduleWorkOrder } from "@/app/(app)/lucrari/actions";
import { cn, formatDate } from "@/src/lib/utils";

type BoardTask = {
  id: string;
  title: string;
  project: string;
  team: string;
  status: string;
  priority: string;
  day: string;
  startDateIso: string | null;
};

const days = ["Luni", "Marti", "Miercuri", "Joi", "Vineri", "Sambata", "Duminica"];

function TaskCard({ task }: { task: BoardTask }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform) }}
      className={cn(
        "rounded-lg border border-[#d8e4dc] bg-white p-2 text-xs shadow-sm",
        isDragging && "opacity-60",
      )}
      {...listeners}
      {...attributes}
    >
      <p className="font-semibold text-[#1f3125]">{task.title}</p>
      <p className="text-[#5d7063]">{task.project}</p>
      <div className="mt-1 flex justify-between text-[11px] text-[#5c6f62]">
        <span>{task.team}</span>
        <span>{task.priority}</span>
      </div>
      <p className="mt-1 text-[11px] text-[#5c6f62]">{task.startDateIso ? formatDate(task.startDateIso) : "Fara data"}</p>
    </div>
  );
}

function DropColumn({
  day,
  children,
  conflicts,
}: {
  day: string;
  children: React.ReactNode;
  conflicts: number;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: day });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "min-h-56 rounded-xl border border-[#d9e4dc] bg-[#f7fbf8] p-3 transition",
        isOver && "border-[#1b7a4a] bg-[#eef8f2]",
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wide text-[#506557]">{day}</p>
        {conflicts > 0 ? <span className="rounded-full bg-[#ffe9cc] px-2 py-0.5 text-[10px] font-semibold text-[#8a5a00]">{conflicts} conflicte</span> : null}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function nextDateForWeekday(weekdayLabel: string) {
  const map: Record<string, number> = {
    Duminica: 0,
    Luni: 1,
    Marti: 2,
    Miercuri: 3,
    Joi: 4,
    Vineri: 5,
    Sambata: 6,
  };

  const target = map[weekdayLabel] ?? 1;
  const now = new Date();
  const current = now.getDay();
  const delta = (target - current + 7) % 7;
  const next = new Date(now);
  next.setDate(now.getDate() + delta);
  next.setHours(8, 0, 0, 0);
  return next;
}

export function PlanningBoard({ initialTasks }: { initialTasks: BoardTask[] }) {
  const [tasks, setTasks] = useState(initialTasks);
  const [isPending, startTransition] = useTransition();

  const conflictsByDay = useMemo(() => {
    const grouped = new Map<string, number>();
    for (const day of days) {
      const teamCounts = new Map<string, number>();
      tasks
        .filter((task) => task.day === day)
        .forEach((task) => teamCounts.set(task.team, (teamCounts.get(task.team) || 0) + 1));
      const conflicts = [...teamCounts.values()].filter((count) => count > 1).length;
      grouped.set(day, conflicts);
    }
    return grouped;
  }, [tasks]);

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const day = String(over.id);
    const taskId = String(active.id);
    const nextDate = nextDateForWeekday(day);

    setTasks((prev) =>
      prev.map((task) =>
        task.id === taskId
          ? {
              ...task,
              day,
              startDateIso: nextDate.toISOString(),
            }
          : task,
      ),
    );

    startTransition(async () => {
      try {
        await rescheduleWorkOrder({ id: taskId, startDate: nextDate.toISOString() });
        toast.success("Planificare actualizata");
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Nu s-a putut actualiza planificarea");
      }
    });
  }

  const grouped = useMemo(() => {
    return days.map((day) => ({ day, items: tasks.filter((task) => task.day === day) }));
  }, [tasks]);

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="mb-3 text-xs text-[#5f7265]">{isPending ? "Se salveaza modificari..." : "Trage o lucrare pe alta zi pentru replanificare."}</div>
      <div className="grid gap-3 overflow-x-auto lg:grid-cols-7">
        {grouped.map((column) => (
          <DropColumn key={column.day} day={column.day} conflicts={conflictsByDay.get(column.day) || 0}>
            {column.items.map((task) => (
              <TaskCard key={task.id} task={task} />
            ))}
          </DropColumn>
        ))}
      </div>
    </DndContext>
  );
}
