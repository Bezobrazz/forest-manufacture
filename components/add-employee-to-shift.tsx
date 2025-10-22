"use client"

import { useState } from "react"
import { addEmployeeToShift } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import type { Employee, Shift } from "@/lib/types"

interface AddEmployeeToShiftProps {
  shift: Shift
  employees: Employee[]
  existingEmployeeIds: number[]
}

export function AddEmployeeToShift({ shift, employees, existingEmployeeIds }: AddEmployeeToShiftProps) {
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>("")
  const [isPending, setIsPending] = useState(false)

  // Фільтруємо працівників, які ще не додані до зміни
  const availableEmployees = employees.filter((employee) => !existingEmployeeIds.includes(employee.id))

  async function handleAddEmployee() {
    if (!selectedEmployeeId) {
      toast.error("Помилка", {
        description: "Виберіть працівника",
      })
      return
    }

    setIsPending(true)

    try {
      const formData = new FormData()
      formData.append("shift_id", shift.id.toString())
      formData.append("employee_id", selectedEmployeeId)

      const result = await addEmployeeToShift(formData)

      if (result.success) {
        toast.success("Працівника додано", {
          description: "Працівника успішно додано до зміни",
        })
        setSelectedEmployeeId("")
      } else {
        toast.error("Помилка", {
          description: result.error,
        })
      }
    } catch (error) {
      toast.error("Помилка", {
        description: "Сталася помилка при додаванні працівника",
      })
    } finally {
      setIsPending(false)
    }
  }

  if (availableEmployees.length === 0) {
    return <div className="text-sm text-muted-foreground">Всі працівники вже додані до зміни</div>
  }

  return (
    <div className="flex gap-2">
      <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
        <SelectTrigger className="w-[200px]">
          <SelectValue placeholder="Виберіть працівника" />
        </SelectTrigger>
        <SelectContent>
          {availableEmployees.map((employee) => (
            <SelectItem key={employee.id} value={employee.id.toString()}>
              {employee.name}
              {employee.position && ` (${employee.position})`}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button onClick={handleAddEmployee} disabled={isPending || !selectedEmployeeId}>
        {isPending ? "Додавання..." : "Додати"}
      </Button>
    </div>
  )
}

