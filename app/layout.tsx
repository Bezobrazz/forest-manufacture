import type { Metadata } from "next";
import "./globals.css";

import { Toaster } from "@/components/ui/sonner";
import { ConditionalFooter } from "@/components/conditional-footer";
import { RuntimeErrorHandler } from "@/components/runtime-error-handler";

export const metadata: Metadata = {
  title: "Облік Виробництва",
  description: "ERP для виробництва Форест Україна",
  generator: "My ERP",
  icons: {
    icon: "/favicon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <body className="flex flex-col min-h-screen">
        <RuntimeErrorHandler />
        <main className="flex-1">{children}</main>
        <ConditionalFooter />
        <Toaster />
      </body>
    </html>
  );
}
