import type { Metadata } from "next";
import "./globals.css";

import { Toaster } from "@/components/ui/sonner";
import { Footer } from "@/components/footer";

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
        <main className="flex-1">
          {children}
        </main>
        <Footer />
        <Toaster />
      </body>
    </html>
  );
}
