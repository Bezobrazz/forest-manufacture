import { getTasks } from "@/app/actions";
import { CreateTaskForm } from "@/components/create-task-form";
import { TaskList } from "@/components/task-list";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function TasksPage() {
  const tasks = await getTasks();

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

      <div className="grid gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Задачі</CardTitle>
            <CardDescription>
              Створюйте та керуйте задачами для виробництва
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6">
              <CreateTaskForm />
              <TaskList tasks={tasks} />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
