"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateTaskStatus, deleteTask } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Trash2, Calendar } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Task } from "@/lib/types";

interface TaskListProps {
  tasks: Task[];
}

export function TaskList({ tasks }: TaskListProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState<number | null>(null);

  async function handleStatusChange(
    taskId: number,
    currentStatus: Task["status"]
  ) {
    setIsPending(taskId);
    try {
      const result = await updateTaskStatus(
        taskId,
        currentStatus === "completed" ? "pending" : "completed"
      );

      if (result.success) {
        toast({
          title: "Статус оновлено",
          description: `Задачу позначено як ${
            currentStatus === "completed" ? "невиконану" : "виконану"
          }`,
        });
        router.refresh();
      } else {
        toast({
          title: "Помилка",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Помилка",
        description: "Сталася помилка при оновленні статусу",
        variant: "destructive",
      });
    } finally {
      setIsPending(null);
    }
  }

  async function handleDelete(taskId: number) {
    setIsPending(taskId);
    try {
      const result = await deleteTask(taskId);

      if (result.success) {
        toast({
          title: "Задачу видалено",
          description: "Задачу успішно видалено",
        });
        router.refresh();
      } else {
        toast({
          title: "Помилка",
          description: result.error,
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Помилка",
        description: "Сталася помилка при видаленні задачі",
        variant: "destructive",
      });
    } finally {
      setIsPending(null);
    }
  }

  const priorityColors = {
    low: "bg-green-500",
    medium: "bg-yellow-500",
    high: "bg-red-500",
  };

  return (
    <div className="space-y-4">
      {tasks.map((task) => (
        <div
          key={task.id}
          className="flex items-start gap-4 p-4 border rounded-lg bg-card"
        >
          <Checkbox
            checked={task.status === "completed"}
            onCheckedChange={() => handleStatusChange(task.id, task.status)}
            disabled={isPending === task.id}
          />
          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <h3
                className={`font-medium ${
                  task.status === "completed"
                    ? "line-through text-muted-foreground"
                    : ""
                }`}
              >
                {task.title}
              </h3>
              <Badge
                variant="secondary"
                className={priorityColors[task.priority]}
              >
                {task.priority === "low"
                  ? "Низький"
                  : task.priority === "medium"
                  ? "Середній"
                  : "Високий"}
              </Badge>
            </div>
            {task.description && (
              <p className="text-sm text-muted-foreground">
                {task.description}
              </p>
            )}
            {task.due_date && (
              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Термін: {formatDate(task.due_date)}</span>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(task.id)}
            disabled={isPending === task.id}
          >
            <Trash2 className="h-4 w-4 text-destructive" />
          </Button>
        </div>
      ))}
    </div>
  );
}
