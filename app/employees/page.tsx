import Link from "next/link";
import { getEmployees } from "@/app/actions";
import { EmployeeForm } from "@/components/employee-form";
import { EmployeeEditButton } from "@/components/employee-edit-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ArrowLeft, User } from "lucide-react";
import { requireRole } from "@/lib/auth/require-role";

export default async function EmployeesPage() {
  // Перевірка прав доступу - дозволено для всіх авторизованих користувачів
  await requireRole(["owner", "admin", "worker"]);

  const employees = await getEmployees();

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

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Працівники</CardTitle>
            <CardDescription>Список всіх працівників у системі</CardDescription>
          </CardHeader>
          <CardContent>
            {employees.length === 0 ? (
              <div className="text-center py-6">
                <p className="text-muted-foreground">
                  Немає зареєстрованих працівників
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {employees.map((employee) => (
                  <div
                    key={employee.id}
                    className="flex items-center justify-between py-2 border-b last:border-0"
                  >
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <div className="font-medium">{employee.name}</div>
                        {employee.position && (
                          <div className="text-sm text-muted-foreground">
                            {employee.position}
                          </div>
                        )}
                      </div>
                    </div>
                    <EmployeeEditButton employee={employee} />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Додати працівника</CardTitle>
            <CardDescription>
              Додайте нового працівника до системи
            </CardDescription>
          </CardHeader>
          <CardContent>
            <EmployeeForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
