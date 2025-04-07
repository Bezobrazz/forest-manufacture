"use client";

import { useState, useEffect } from "react";
import { getTasks } from "@/app/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, CheckSquare, ArrowLeft } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { Task } from "@/lib/types";
import { Skeleton } from "@/components/ui/skeleton";
import { DatabaseError } from "@/components/database-error";
import Link from "next/link";
import { CreateTaskForm } from "@/components/create-task-form";
import { EditTaskForm } from "@/components/edit-task-form";
import { DeleteTaskButton } from "@/components/delete-task-button";
import { CompleteTaskButton } from "@/components/complete-task-button";

type TaskFilter = "all" | "active" | "completed";

function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-4">
        {[...Array(5)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-6 w-24" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-32" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [databaseError, setDatabaseError] = useState(false);
  const [filter, setFilter] = useState<TaskFilter>("all");

  // Завантаження даних
  const loadTasks = async () => {
    setIsLoading(true);
    setDatabaseError(false);

    try {
      const data = await getTasks();
      setTasks(data);
    } catch (err: any) {
      console.error("Помилка при завантаженні задач:", err);
      if (err?.message?.includes("Supabase")) {
        setDatabaseError(true);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  // Завантаження збереженого фільтра
  useEffect(() => {
    const savedFilter = localStorage.getItem("taskFilter") as TaskFilter;
    if (savedFilter) {
      setFilter(savedFilter);
    }
  }, []);

  // Збереження вибраного фільтра
  const handleFilterChange = (newFilter: TaskFilter) => {
    setFilter(newFilter);
    localStorage.setItem("taskFilter", newFilter);
  };

  // Фільтрація задач
  const filteredTasks = tasks.filter((task) => {
    switch (filter) {
      case "active":
        return task.status === "pending";
      case "completed":
        return task.status === "completed";
      default:
        return true;
    }
  });

  if (databaseError) {
    return (
      <div className="container py-12">
        <DatabaseError onRetry={() => window.location.reload()} />
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container py-6">
        <LoadingSkeleton />
      </div>
    );
  }

  return (
    <div className="container py-6">
      <div className="mb-6">
        <Link
          href="/"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Назад</span>
        </Link>
      </div>

      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Задачі</h1>
        <div className="flex items-center gap-2">
          <CreateTaskForm onTaskCreated={loadTasks} />
          <Button
            variant={filter === "all" ? "default" : "outline"}
            onClick={() => handleFilterChange("all")}
          >
            Всі
          </Button>
          <Button
            variant={filter === "active" ? "default" : "outline"}
            onClick={() => handleFilterChange("active")}
          >
            Активні
          </Button>
          <Button
            variant={filter === "completed" ? "default" : "outline"}
            onClick={() => handleFilterChange("completed")}
          >
            Виконані
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {filteredTasks.length === 0 ? (
          <Card>
            <CardContent className="py-8">
              <div className="text-center text-muted-foreground">
                {filter === "all"
                  ? "Немає задач"
                  : filter === "active"
                  ? "Немає активних задач"
                  : "Немає виконаних задач"}
              </div>
            </CardContent>
          </Card>
        ) : (
          filteredTasks.map((task) => (
            <Card key={task.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle
                    className={`text-lg ${
                      task.status === "completed"
                        ? "line-through text-muted-foreground"
                        : ""
                    }`}
                  >
                    {task.title}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        task.status === "completed" ? "secondary" : "default"
                      }
                    >
                      {task.status === "completed" ? "Виконано" : "Активна"}
                    </Badge>
                    {task.status === "pending" && (
                      <CompleteTaskButton
                        task={task}
                        onTaskCompleted={loadTasks}
                      />
                    )}
                    <EditTaskForm task={task} onTaskUpdated={loadTasks} />
                    <DeleteTaskButton
                      taskId={task.id}
                      taskTitle={task.title}
                      onTaskDeleted={loadTasks}
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
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
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={
                        task.priority === "low"
                          ? "bg-green-500"
                          : task.priority === "medium"
                          ? "bg-yellow-500"
                          : "bg-red-500"
                      }
                    >
                      {task.priority === "low"
                        ? "Низький"
                        : task.priority === "medium"
                        ? "Середній"
                        : "Високий"}
                    </Badge>
                    {task.status === "completed" && task.completed_at && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground">
                        <CheckSquare className="h-4 w-4" />
                        <span>Завершено: {formatDate(task.completed_at)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
