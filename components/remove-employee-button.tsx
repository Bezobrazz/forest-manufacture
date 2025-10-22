"use client"

import { useState } from "react"
import { removeEmployeeFromShift } from "@/app/actions"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { X } from "lucide-react"

interface RemoveEmployeeButtonProps {
  shiftId: number
  employeeId: number
}

export function RemoveEmployeeButton({ shiftId, employeeId }: RemoveEmployeeButtonProps) {
  const [isPending, setIsPending] = useState(false)

  async function handleRemove() {
    setIsPending(true)

    try {
      const result = await removeEmployeeFromShift(shiftId, employeeId)

      if (result.success) {
        toast.success("Працівника видалено", {
          description: "Працівника успішно видалено зі зміни",
        })
      } else {
        toast.error("Помилка", {
          description: result.error,
        })
      }
    } catch (error) {
      toast.error("Помилка", {
        description: "Сталася помилка при видаленні працівника",
      })
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      className="h-8 w-8 text-muted-foreground hover:text-destructive"
      onClick={handleRemove}
      disabled={isPending}
    >
      {isPending ? (
        <span className="animate-spin h-4 w-4 border-2 border-current border-t-transparent rounded-full" />
      ) : (
        <X className="h-4 w-4" />
      )}
      <span className="sr-only">Видалити</span>
    </Button>
  )
}

