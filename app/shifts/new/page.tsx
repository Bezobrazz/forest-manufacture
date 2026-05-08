import Link from "next/link"
import { getEmployees } from "@/app/actions"
import { CreateShiftForm } from "@/components/create-shift-form"
import { ArrowLeft } from "lucide-react"
import { QuickActionsButton } from "@/components/quick-actions-button"

export const dynamic = "force-dynamic"

export default async function NewShiftPage() {
  const employees = await getEmployees()

  return (
    <div className="container py-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          <span>Назад</span>
        </Link>
        <QuickActionsButton />
      </div>

      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Створення нової зміни</h1>
        <CreateShiftForm employees={employees} />
      </div>
    </div>
  )
}

