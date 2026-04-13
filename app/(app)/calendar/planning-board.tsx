"use client";

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

type Task = {
  id: string;
  title: string;
  project: string;
  team: string;
  status: string;
  priority: string;
  day: string;
  startDateIso: string | null;
};

const weekdays = ["Luni", "Marti", "Miercuri", "Joi", "Vineri", "Sambata", "Duminica"];

function cardTone(priority: string) {
  if (priority === "CRITICAL") return "border-[#7d3a45] bg-[rgba(98,42,50,0.42)]";
  if (priority === "HIGH") return "border-[#82683c] bg-[rgba(109,84,42,0.3)]";
  return "border-[color:var(--border)] bg-[rgba(17,29,50,0.9)]";
}

function DraggableTaskCard({ task }: { task: Task }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: task.id, data: task });

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
      className={`touch-none cursor-grab rounded-xl border p-2.5 text-xs shadow-[0_10px_25px_-18px_rgba(0,0,0,0.85)] transition hover:border-[#4e73aa] active:cursor-grabbing ${cardTone(task.priority)}`}
    >
      <p className="font-semibold text-[#ecf3ff]">{task.title}</p>
      <p className="text-[#a8bbd6]">{task.project}</p>
      <div className="mt-1 flex justify-between text-[11px] text-[#90a5c2]">
        <span>{task.team}</span>
        <span>{task.status}</span>
      </div>
      <p className="mt-1 text-[11px] text-[#8da3c1]">{task.startDateIso ? formatDate(task.startDateIso) : "Fara data"}</p>
    </div>
  );
}

function DayColumn({ day, tasks, conflicts }: { day: string; tasks: Task[]; conflicts: number }) {
  const { setNodeRef, isOver } = useDroppable({ id: day });

  return (
    <div
      ref={setNodeRef}
      className={[
        "min-h-56 rounded-2xl border p-3 transition",
        isOver
          ? "border-[#4f79ba] bg-[rgba(31,52,86,0.42)]"
          : "border-[color:var(--border)] bg-[rgba(10,18,33,0.84)]",
      ].join(" ")}
    >
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[#92a6c3]">{day}</p>
        {conflicts > 0 ? (
          <span className="rounded-full border border-[rgba(213,170,69,0.45)] bg-[rgba(213,170,69,0.16)] px-2 py-0.5 text-[10px] font-semibold text-[#f2cf77]">
            {conflicts} conflicte
          </span>
        ) : null}
      </div>
      <div className="space-y-2">
        {tasks.map((task) => (
          <DraggableTaskCard key={task.id} task={task} />
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

  const tasksByDay = useMemo(() => {
    return weekdays.reduce<Record<string, Task[]>>((acc, day) => {
      acc[day] = tasks.filter((task) => task.day === day);
      return acc;
    }, {});
  }, [tasks]);

  const conflictsByDay = useMemo(() => {
    const output: Record<string, number> = {};
    for (const day of weekdays) {
      const dayTasks = tasksByDay[day] ?? [];
      const duplicateTeams = dayTasks.filter(
        (item, index) => dayTasks.findIndex((candidate) => candidate.team === item.team) !== index,
      );
      output[day] = duplicateTeams.length;
    }
    return output;
  }, [tasksByDay]);

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
      <div className="mb-3 text-xs text-[#9fb2cd]">
        {isPending ? "Se salveaza replanificarea..." : "Trage o lucrare intre zile pentru a actualiza programul saptamanii."}
      </div>
      {error ? <p className="mb-3 text-xs font-medium text-[#ffb7bf]">{error}</p> : null}
      <DndContext collisionDetection={closestCorners} sensors={sensors} onDragEnd={onDragEnd} onDragStart={onDragStart}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-7">
          {weekdays.map((day) => (
            <DayColumn key={day} day={day} tasks={tasksByDay[day] ?? []} conflicts={conflictsByDay[day] ?? 0} />
          ))}
        </div>
        <DragOverlay>{activeTask ? <DraggableTaskCard task={activeTask} /> : null}</DragOverlay>
      </DndContext>
    </div>
  );
}
