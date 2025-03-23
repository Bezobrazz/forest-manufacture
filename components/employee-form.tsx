"use client"

import { useState } from "react"
import { createEmployee } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "@/components/ui/use-toast"

export function EmployeeForm() {
  const [isPending, setIsPending] = useState(false)

  async function handleSubmit(formData: FormData) {
    setIsPending(true)

    try {
      const result = await createEmployee(formData)

      if (result.success) {
        toast({
          title: "Працівника додано",
          description: "Нового працівника успішно додано до системи",
        })

        // Очищаємо форму
        const form = document.getElementById("employee-form") as HTMLFormElement
        form.reset()
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
        description: "Сталася помилка при додаванні працівника",
        variant: "destructive",
      })
    } finally {
      setIsPending(false)
    }
  }

  return (
    <form id="employee-form" action={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Ім'я працівника</Label>
        <Input id="name" name="name" required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="position">Посада</Label>
        <Input id="position" name="position" />
      </div>
      <Button type="submit" disabled={isPending}>
        {isPending ? "Додавання..." : "Додати працівника"}
      </Button>
    </form>
  )
}

