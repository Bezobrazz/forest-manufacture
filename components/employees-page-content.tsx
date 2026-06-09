"use client";

import { EmployeeForm } from "@/components/employee-form";
import { EmployeeEditButton } from "@/components/employee-edit-button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shield, User } from "lucide-react";
import type { Employee } from "@/lib/types";
import { formatNumberWithUnit } from "@/lib/utils";

type EmployeesPageContentProps = {
  employees: Employee[];
};

function EmployeeList({
  employees,
  emptyMessage,
  icon: Icon,
  showSalary = false,
}: {
  employees: Employee[];
  emptyMessage: string;
  icon: typeof User;
  showSalary?: boolean;
}) {
  if (employees.length === 0) {
    return (
      <div className="py-6 text-center">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {employees.map((employee) => (
        <div
          key={employee.id}
          className="flex items-center justify-between border-b py-2 last:border-0"
        >
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-muted-foreground" />
            <div>
              <div className="font-medium">{employee.name}</div>
              {employee.position && (
                <div className="text-sm text-muted-foreground">
                  {employee.position}
                </div>
              )}
              {showSalary && employee.salary != null && (
                <div className="text-sm text-muted-foreground">
                  Оклад: {formatNumberWithUnit(employee.salary, "₴")}
                </div>
              )}
            </div>
          </div>
          <EmployeeEditButton employee={employee} />
        </div>
      ))}
    </div>
  );
}

export function EmployeesPageContent({ employees }: EmployeesPageContentProps) {
  const workers = employees.filter((employee) => !employee.is_manager);
  const managers = employees.filter((employee) => employee.is_manager);

  return (
    <Tabs defaultValue="workers" className="space-y-6">
      <TabsList className="grid w-full max-w-md grid-cols-2 bg-muted p-1 rounded-lg">
        <TabsTrigger value="workers" className="text-sm">
          Працівники
        </TabsTrigger>
        <TabsTrigger value="managers" className="text-sm">
          Керівники
        </TabsTrigger>
      </TabsList>

      <TabsContent value="workers" className="mt-0">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Працівники</CardTitle>
              <CardDescription>
                Список працівників, які працюють на змінах
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmployeeList
                employees={workers}
                emptyMessage="Немає зареєстрованих працівників"
                icon={User}
              />
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
              <EmployeeForm isManager={false} />
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="managers" className="mt-0">
        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Керівники</CardTitle>
              <CardDescription>
                Список керівників та відповідальних осіб
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmployeeList
                employees={managers}
                emptyMessage="Немає зареєстрованих керівників"
                icon={Shield}
                showSalary
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Додати керівника</CardTitle>
              <CardDescription>
                Додайте нового керівника до системи
              </CardDescription>
            </CardHeader>
            <CardContent>
              <EmployeeForm isManager />
            </CardContent>
          </Card>
        </div>
      </TabsContent>
    </Tabs>
  );
}
