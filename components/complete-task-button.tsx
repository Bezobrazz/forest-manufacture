"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateTask } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckSquare } from "lucide-react";
import type { Task } from "@/lib/types";

interface CompleteTaskButtonProps {
  task: Task;
  onTaskCompleted?: () => void;
}

export function CompleteTaskButton({
  task,
  onTaskCompleted,
}: CompleteTaskButtonProps) {
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();

  async function handleComplete() {
    setIsPending(true);

    try {
      const result = await updateTask(task.id, {
        title: task.title,
        description: task.description,
        priority: task.priority,
        due_date: task.due_date,
        status: "completed",
      });

      if (result.success) {
        toast.success("Задачу виконано", {
          description: "Задачу успішно позначено як виконану",
        });
        router.refresh();
        onTaskCompleted?.();
      } else {
        toast.error("Помилка", {
          description: result.error,
        });
      }
    } catch (error) {
      toast.error("Помилка", {
        description: "Сталася помилка при оновленні статусу задачі",
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="icon"
      onClick={handleComplete}
      disabled={isPending}
    >
      <CheckSquare className="h-4 w-4" />
    </Button>
  );
}
