import { requireRole } from "@/lib/auth/require-role";
import { listMiniAppAccesses } from "@/app/actions/mini-app-access";
import { MiniAppAccessManager } from "@/components/mini-app-access-manager";
import { PreviousPageButton } from "@/components/previous-page-button";
import { QuickActionsButton } from "@/components/quick-actions-button";

export default async function MiniAppAccessPage() {
  await requireRole(["owner", "admin"]);
  const items = await listMiniAppAccesses();

  return (
    <div className="container py-6 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <PreviousPageButton fallbackHref="/" />
        <QuickActionsButton />
      </div>
      <div>
        <h1 className="text-2xl font-semibold">Доступи Mini App</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Робітники без логіна ERP: створіть доступ, згенеруйте код і надішліть у
          Telegram. При звільненні — заблокуйте.
        </p>
      </div>
      <MiniAppAccessManager initialItems={items} />
    </div>
  );
}
