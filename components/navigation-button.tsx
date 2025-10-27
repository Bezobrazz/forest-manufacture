"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface NavigationButtonProps {
  href: string;
  children: React.ReactNode;
  variant?:
    | "default"
    | "destructive"
    | "outline"
    | "secondary"
    | "ghost"
    | "link";
  size?: "default" | "sm" | "lg" | "icon";
  className?: string;
  isCurrentWeek?: boolean;
  currentWeekMessage?: string;
}

export function NavigationButton({
  href,
  children,
  variant = "outline",
  size = "sm",
  className,
  isCurrentWeek = false,
  currentWeekMessage = "Ви вже переглядаєте поточний тиждень",
}: NavigationButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Скидаємо стан завантаження при зміні URL або при зміні поточного тижня
  useEffect(() => {
    // Скидаємо стан через невелику затримку після навігації
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 100);

    return () => clearTimeout(timer);
  }, [href, isCurrentWeek]);

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();

    // Якщо це поточний тиждень, показуємо повідомлення
    if (isCurrentWeek) {
      toast.info(currentWeekMessage);
      // Скидаємо стан завантаження, якщо він був встановлений
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    router.push(href);
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onClick={handleClick}
      disabled={isLoading}
    >
      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </Button>
  );
}
