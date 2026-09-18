import Script from "next/script";
import { getServerUser } from "@/lib/supabase/server-auth";
import { TelegramSessionGate } from "./telegram-session-gate";

export default async function MiniAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getServerUser();

  return (
    <div className="mx-auto min-h-screen w-full max-w-lg bg-background pb-[env(safe-area-inset-bottom)]">
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />
      <TelegramSessionGate isAuthenticated={!!user}>
        {children}
      </TelegramSessionGate>
    </div>
  );
}
