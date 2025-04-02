"use client";

import { useState, useEffect } from "react";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-10 w-full" />
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-24 w-full" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Skeleton className="h-10 w-24" />
      </div>
    </div>
  );
}

export function CreateTaskForm() {
  const [isPending, setIsPending] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [dueDate, setDueDate] = useState("");

  useEffect(() => {
    // Імітуємо завантаження даних
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

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
        setIsOpen(false);
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
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="h-4 w-4 mr-2" />
          <span>Створити задачу</span>
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Створення нової задачі</DialogTitle>
          <DialogDescription>
            Заповніть форму для створення нової задачі
          </DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <LoadingSkeleton />
        ) : (
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

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                Скасувати
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Створення..." : "Створити задачу"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
