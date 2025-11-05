"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { getSupabaseClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { LogOut } from "lucide-react";

export function LogoutButton() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        toast.error("Помилка", {
          description: "Не вдалося вийти з системи",
        });
        return;
      }

      toast.success("Ви успішно вийшли з системи");
      router.push("/auth/login");
      router.refresh();
    } catch (error: any) {
      toast.error("Помилка", {
        description: error.message || "Сталася помилка при виході",
      });
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleLogout}
      className="gap-2"
    >
      <LogOut className="h-4 w-4" />
      <span>Вийти</span>
    </Button>
  );
}

