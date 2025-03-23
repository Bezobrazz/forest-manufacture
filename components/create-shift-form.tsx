"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createShift, createShiftWithEmployees } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "@/components/ui/use-toast"
import { Checkbox } from "@/components/ui/checkbox"
import type { Employee } from "@/lib/types"

interface CreateShiftFormProps {
  employees: Employee[]
}

export function CreateShiftForm({ employees }: CreateShiftFormProps) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([])

  function handleEmployeeToggle(employeeId: number) {
    setSelectedEmployees((prev) => {
      if (prev.includes(employeeId)) {
        return prev.filter((id) => id !== employeeId)
      } else {
        return [...prev, employeeId]
      }
    })
  }

  async function handleSubmit(formData: FormData) {
    setIsPending(true)

    try {
      let result

      if (selectedEmployees.length > 0) {
        result = await createShiftWithEmployees(formData, selectedEmployees)
      } else {
        result = await createShift(formData)
      }

      if (result.success) {
        toast({
          title: "Зміну створено",
          description: "Нову зміну успішно створено",
        })

        // Перенаправляємо на сторінку зміни
        if (result.data && result.data[0]) {
          router.push(`/shifts/${result.data[0].id}`)
        } else {
          router.push("/")
        }
      } else {
        toast({
          title: "Помилка",
          description: result.error,
          variant: "destructive",
        })
      }
    } catch (error) {
      toast({
        title: "Помилка",
        description: "Сталася помилка при створенні зміни",
        variant: "destructive",
      })
    } finally {
      setIsPending(false)
    }
  }

  return (
    <form action={handleSubmit}>
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Інформація про зміну</CardTitle>
          <CardDescription>Введіть основну інформацію про нову зміну</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="shift_date">Дата зміни</Label>
            <Input
              id="shift_date"
              name="shift_date"
              type="date"
              defaultValue={new Date().toISOString().split("T")[0]}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Примітки</Label>
            <Textarea id="notes" name="notes" rows={3} placeholder="Додаткова інформація про зміну" />
          </div>
        </CardContent>
      </Card>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Працівники на зміні</CardTitle>
          <CardDescription>Виберіть працівників, які будуть працювати на цій зміні</CardDescription>
        </CardHeader>
        <CardContent>
          {employees.length === 0 ? (
            <div className="text-sm text-muted-foreground">Немає доступних працівників</div>
          ) : (
            <div className="grid gap-2 md:grid-cols-2">
              {employees.map((employee) => (
                <div key={employee.id} className="flex items-center space-x-2">
                  <Checkbox
                    id={`employee-${employee.id}`}
                    checked={selectedEmployees.includes(employee.id)}
                    onCheckedChange={() => handleEmployeeToggle(employee.id)}
                  />
                  <Label htmlFor={`employee-${employee.id}`} className="cursor-pointer">
                    {employee.name}
                    {employee.position && <span className="text-muted-foreground ml-1">({employee.position})</span>}
                  </Label>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-4">
        <Button type="button" variant="outline" onClick={() => router.push("/")}>
          Скасувати
        </Button>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Створення..." : "Створити зміну"}
        </Button>
      </div>
    </form>
  )
}

