"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateTask } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { toast } from "@/hooks/use-toast";
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
        toast({
          title: "Задачу виконано",
          description: "Задачу успішно позначено як виконану",
        });
        router.refresh();
        onTaskCompleted?.();
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
        description: "Сталася помилка при оновленні статусу задачі",
        variant: "destructive",
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
