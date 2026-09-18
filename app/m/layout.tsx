import Script from "next/script";
import { getMiniAppAccessFromCookie } from "@/lib/telegram/mini-app-session";
import { TelegramSessionGate } from "./telegram-session-gate";

export default async function MiniAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const access = await getMiniAppAccessFromCookie();

  return (
    <div className="mx-auto min-h-screen w-full max-w-lg bg-background pb-[env(safe-area-inset-bottom)]">
      <Script
        src="https://telegram.org/js/telegram-web-app.js"
        strategy="beforeInteractive"
      />
      <TelegramSessionGate hasAccessSession={!!access}>
        {children}
      </TelegramSessionGate>
    </div>
  );
}
