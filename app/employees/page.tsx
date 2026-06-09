import { getEmployees } from "@/app/actions";
import { EmployeesPageContent } from "@/components/employees-page-content";
import { requireRole } from "@/lib/auth/require-role";
import { QuickActionsButton } from "@/components/quick-actions-button";
import { PreviousPageButton } from "@/components/previous-page-button";

export default async function EmployeesPage() {
  await requireRole(["owner", "admin", "worker"]);

  const employees = await getEmployees();

  return (
    <div className="container py-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <PreviousPageButton fallbackHref="/" />
        <QuickActionsButton />
      </div>

      <EmployeesPageContent employees={employees} />
    </div>
  );
}
