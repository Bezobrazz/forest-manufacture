"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createTask } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function CreateTaskForm() {
  const [isPending, setIsPending] = useState(false);
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [dueDate, setDueDate] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsPending(true);

    try {
      const result = await createTask({
        title,
        description: description || null,
        priority,
        due_date: dueDate || null,
        status: "pending",
      });

      if (result.success) {
        toast({
          title: "Задачу створено",
          description: "Задачу успішно створено",
        });
        setTitle("");
        setDescription("");
        setPriority("medium");
        setDueDate("");
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
        description: "Сталася помилка при створенні задачі",
        variant: "destructive",
      });
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="title">Назва задачі</Label>
        <Input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Введіть назву задачі"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Опис</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Введіть опис задачі"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="priority">Пріоритет</Label>
          <Select
            value={priority}
            onValueChange={(value: "low" | "medium" | "high") =>
              setPriority(value)
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Виберіть пріоритет" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="low">Низький</SelectItem>
              <SelectItem value="medium">Середній</SelectItem>
              <SelectItem value="high">Високий</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="dueDate">Термін виконання</Label>
          <Input
            id="dueDate"
            type="date"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
      </div>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Створення..." : "Створити задачу"}
      </Button>
    </form>
  );
}
