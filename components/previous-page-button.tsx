"use client";

import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";

interface PreviousPageButtonProps {
  fallbackHref?: string;
}

export function PreviousPageButton({
  fallbackHref = "/",
}: PreviousPageButtonProps) {
  const router = useRouter();

  function handleClick() {
    if (window.history.length > 1) {
      router.back();
      return;
    }

    router.push(fallbackHref);
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      <span>Назад</span>
    </button>
  );
}
