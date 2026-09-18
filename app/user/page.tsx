import { requireAuth } from "@/lib/auth/require-role";
import { createServerSupabaseClient } from "@/lib/supabase/server-auth";
import { QuickActionsButton } from "@/components/quick-actions-button";
import { PreviousPageButton } from "@/components/previous-page-button";
import { UserPageClient } from "@/components/user-page-client";
import { listMiniAppAccesses } from "@/app/actions/mini-app-access";

export default async function UserPage() {
  const { user, role } = await requireAuth();
  const canManageMiniApp = role === "owner" || role === "admin";

  const supabase = await createServerSupabaseClient();
  const { data: userData } = await supabase
    .from("users")
    .select("created_at, telegram_id")
    .eq("id", user.id)
    .single();

  const createdAt = userData?.created_at
    ? new Date(userData.created_at)
    : user.created_at
      ? new Date(user.created_at)
      : null;

  const createdAtLabel = createdAt
    ? new Intl.DateTimeFormat("uk-UA", {
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
      }).format(createdAt)
    : null;

  const miniAppAccesses = canManageMiniApp ? await listMiniAppAccesses() : [];

  return (
    <div className="container py-6">
      <div className="mb-6 flex items-center justify-between gap-4">
        <PreviousPageButton fallbackHref="/" />
        <QuickActionsButton />
      </div>

      <div className={canManageMiniApp ? "max-w-4xl mx-auto" : "max-w-2xl mx-auto"}>
        <UserPageClient
          email={user.email ?? null}
          userId={user.id}
          role={role}
          createdAtLabel={createdAtLabel}
          telegramLinked={userData?.telegram_id != null}
          telegramId={
            userData?.telegram_id != null ? Number(userData.telegram_id) : null
          }
          canManageMiniApp={canManageMiniApp}
          miniAppAccesses={miniAppAccesses}
        />
      </div>
    </div>
  );
}
