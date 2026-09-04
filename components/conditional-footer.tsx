"use client";

import { usePathname } from "next/navigation";
import { Footer } from "@/components/footer";

export function ConditionalFooter() {
  const pathname = usePathname();
  
  // Приховуємо футер на сторінках авторизації та Mini App
  if (pathname?.startsWith("/auth/") || pathname?.startsWith("/m")) {
    return null;
  }

  return <Footer />;
}

