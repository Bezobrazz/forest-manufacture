"use client";

import { usePathname } from "next/navigation";
import { Footer } from "@/components/footer";

export function ConditionalFooter() {
  const pathname = usePathname();
  
  // Приховуємо футер на сторінках авторизації
  if (pathname?.startsWith("/auth/")) {
    return null;
  }

  return <Footer />;
}

