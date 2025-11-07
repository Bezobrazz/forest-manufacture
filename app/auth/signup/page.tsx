"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import Image from "next/image";

export default function SignupPage() {
  const router = useRouter();

  useEffect(() => {
    // Перенаправляємо на сторінку логіну з параметром для показу тосту
    router.push("/auth/login?fromSignup=true");
  }, [router]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-muted/50">
      <div className="mb-8">
        <Image
          src="/main-logo.png"
          alt="Логотип"
          width={150}
          height={150}
          className="object-contain"
          priority
        />
      </div>
      <Loader2 className="h-8 w-8 animate-spin" />
    </div>
  );
}

