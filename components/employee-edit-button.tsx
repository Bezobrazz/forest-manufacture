"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { EmployeeEditForm } from "@/components/employee-edit-form";

type Employee = {
  id: number;
  name: string;
  position: string | null;
};

type EmployeeEditButtonProps = {
  employee: Employee;
};

export function EmployeeEditButton({ employee }: EmployeeEditButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button variant="ghost" size="icon" onClick={() => setIsOpen(true)}>
        <Pencil className="h-4 w-4" />
      </Button>
      <EmployeeEditForm
        employee={employee}
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
      />
    </>
  );
}
