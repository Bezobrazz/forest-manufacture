import { CreateShiftForm } from "@/components/create-shift-form"
import { QuickActionsButton } from "@/components/quick-actions-button"
import { PreviousPageButton } from "@/components/previous-page-button"

export const dynamic = "force-dynamic"

export default function NewShiftPage() {
  return (
    <div className="container min-w-0 py-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <PreviousPageButton fallbackHref="/" />
        <QuickActionsButton />
      </div>

      <div className="mx-auto min-w-0 max-w-2xl">
        <h1 className="text-2xl font-bold mb-6">Створення нової зміни</h1>
        <CreateShiftForm />
      </div>
    </div>
  )
}
