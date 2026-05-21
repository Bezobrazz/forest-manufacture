"use client"

import { useState } from "react"
import { useFormStatus } from "react-dom"
import { useRouter } from "next/navigation"
import { createShift, createShiftWithEmployees } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Checkbox } from "@/components/ui/checkbox"
import { Calendar as CalendarIcon, Loader2 } from "lucide-react"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { cn, dateToYYYYMMDD, formatDate } from "@/lib/utils"
import { uk } from "date-fns/locale"
import type { Employee } from "@/lib/types"

interface CreateShiftFormProps {
  employees: Employee[]
}

function CreateShiftFormActions({ onCancel }: { onCancel: () => void }) {
  const { pending } = useFormStatus()

  return (
    <div className="flex flex-col-reverse gap-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] sm:flex-row sm:justify-end">
      <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
        Скасувати
      </Button>
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Створення...
          </>
        ) : (
          "Створити зміну"
        )}
      </Button>
    </div>
  )
}

export function CreateShiftForm({ employees }: CreateShiftFormProps) {
  const router = useRouter()
  const [selectedEmployees, setSelectedEmployees] = useState<number[]>([])
  const [shiftDate, setShiftDate] = useState<Date>(new Date())
  const [openedAt, setOpenedAt] = useState<Date | undefined>()
  const [shiftDatePopoverOpen, setShiftDatePopoverOpen] = useState(false)
  const [openedAtPopoverOpen, setOpenedAtPopoverOpen] = useState(false)

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
    try {
      let result

      if (selectedEmployees.length > 0) {
        result = await createShiftWithEmployees(formData, selectedEmployees)
      } else {
        result = await createShift(formData)
      }

      if (result.success) {
        toast.success("Зміну створено", {
          description: "Нову зміну успішно створено",
        })

        if (result.data && result.data[0]) {
          router.push(`/shifts/${result.data[0].id}`)
        } else {
          router.push("/")
        }
      } else {
        toast.error("Помилка", {
          description: result.error,
        })
      }
    } catch (error) {
      toast.error("Помилка", {
        description: "Сталася помилка при створенні зміни",
      })
    }
  }

  return (
    <form action={handleSubmit} className="min-w-0">
      <input type="hidden" name="shift_date" value={dateToYYYYMMDD(shiftDate)} />
      {openedAt && (
        <input type="hidden" name="opened_at" value={dateToYYYYMMDD(openedAt)} />
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Інформація про зміну</CardTitle>
          <CardDescription>Введіть основну інформацію про нову зміну</CardDescription>
        </CardHeader>
        <CardContent className="min-w-0 space-y-4">
          <div className="min-w-0 space-y-2">
            <Label htmlFor="shift_date">Дата зміни</Label>
            <Popover open={shiftDatePopoverOpen} onOpenChange={setShiftDatePopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="shift_date"
                  type="button"
                  variant="outline"
                  className={cn(
                    "w-full min-w-0 justify-start text-left font-normal",
                    !shiftDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                  {shiftDate ? (
                    formatDate(shiftDate.toISOString())
                  ) : (
                    <span>Оберіть дату</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={shiftDate}
                  onSelect={(nextDate) => {
                    if (nextDate) {
                      setShiftDate(nextDate)
                      setShiftDatePopoverOpen(false)
                    }
                  }}
                  locale={uk}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="min-w-0 space-y-2">
            <Label htmlFor="opened_at">Дата відкриття зміни (опціонально)</Label>
            <Popover open={openedAtPopoverOpen} onOpenChange={setOpenedAtPopoverOpen}>
              <PopoverTrigger asChild>
                <Button
                  id="opened_at"
                  type="button"
                  variant="outline"
                  className={cn(
                    "w-full min-w-0 justify-start text-left font-normal",
                    !openedAt && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4 shrink-0" />
                  {openedAt ? (
                    formatDate(openedAt.toISOString())
                  ) : (
                    <span>Оберіть дату</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={openedAt}
                  onSelect={(nextDate) => {
                    setOpenedAt(nextDate)
                    if (nextDate) setOpenedAtPopoverOpen(false)
                  }}
                  locale={uk}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            <p className="text-xs text-muted-foreground">
              Якщо не вказано, буде використано поточну дату
            </p>
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
        <CardContent className="min-w-0">
          {employees.length === 0 ? (
            <div className="text-sm text-muted-foreground">Немає доступних працівників</div>
          ) : (
            <div className="flex flex-col gap-2 md:grid md:grid-cols-2">
              {employees.map((employee) => {
                const isSelected = selectedEmployees.includes(employee.id)
                return (
                  <label
                    key={employee.id}
                    htmlFor={`employee-${employee.id}`}
                    className={cn(
                      "flex min-h-14 cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 transition-colors active:bg-accent md:min-h-12",
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-input hover:bg-muted/50"
                    )}
                  >
                    <Checkbox
                      id={`employee-${employee.id}`}
                      checked={isSelected}
                      onCheckedChange={() => handleEmployeeToggle(employee.id)}
                      className="h-5 w-5 shrink-0"
                    />
                    <span className="min-w-0 flex-1 text-base leading-snug">
                      {employee.name}
                      {employee.position && (
                        <span className="mt-0.5 block text-sm text-muted-foreground md:inline md:mt-0 md:ml-1">
                          {employee.position}
                        </span>
                      )}
                    </span>
                  </label>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <CreateShiftFormActions onCancel={() => router.push("/")} />
    </form>
  )
}
