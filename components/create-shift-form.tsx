"use client"

import { useState } from "react"
import { useFormStatus } from "react-dom"
import { useRouter } from "next/navigation"
import { createShift } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { toast } from "sonner"
import { Calendar as CalendarIcon, Loader2 } from "lucide-react"
import { Calendar as CalendarComponent } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ShiftEmployeeCountField } from "@/components/shift-employee-count-field"
import { parseShiftEmployeeCount } from "@/lib/shifts/employee-count"
import { cn, dateToYYYYMMDD, formatDate } from "@/lib/utils"
import { uk } from "date-fns/locale"

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

export function CreateShiftForm() {
  const router = useRouter()
  const [shiftDate, setShiftDate] = useState<Date>(new Date())
  const [shiftDatePopoverOpen, setShiftDatePopoverOpen] = useState(false)
  const [employeeCount, setEmployeeCount] = useState<number | null>(null)

  async function handleSubmit(formData: FormData) {
    if (!parseShiftEmployeeCount(employeeCount)) {
      toast.error("Оберіть кількість працівників")
      return
    }

    try {
      const result = await createShift(formData)

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
      {employeeCount ? (
        <input type="hidden" name="employee_count" value={String(employeeCount)} />
      ) : null}

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
            <p className="text-xs text-muted-foreground">
              Ця дата також є датою відкриття зміни
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
          <CardDescription>Оберіть кількість працівників на цій зміні</CardDescription>
        </CardHeader>
        <CardContent className="min-w-0">
          <ShiftEmployeeCountField
            value={employeeCount}
            onChange={setEmployeeCount}
          />
        </CardContent>
      </Card>

      <CreateShiftFormActions onCancel={() => router.push("/")} />
    </form>
  )
}
