import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server-auth";
import { getUserRole } from "@/lib/auth/get-user-role";

// ⚠️ ЦЕ ТИМЧАСОВИЙ API ROUTE ДЛЯ ВИДАЛЕННЯ КОРИСТУВАЧА
// Після використання ВИДАЛІТЬ цей файл!

export async function POST(request: Request) {
  try {
    // Перевірка авторизації та ролі
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Перевірка, чи користувач має роль owner або admin
    const userRole = await getUserRole(user.id);
    if (!userRole || (userRole !== 'owner' && userRole !== 'admin')) {
      return NextResponse.json(
        { error: "Forbidden: Only owners and admins can delete users" },
        { status: 403 }
      );
    }

    const { userId } = await request.json();

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required" },
        { status: 400 }
      );
    }

    // Отримуємо Service Role Key з змінних середовища
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { 
          error: "Supabase credentials are missing. Please add SUPABASE_SERVICE_ROLE_KEY to .env.local" 
        },
        { status: 500 }
      );
    }

    // Створюємо клієнт з Service Role Key
    const adminSupabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Видаляємо користувача через Admin API
    const { data, error } = await adminSupabase.auth.admin.deleteUser(userId);

    if (error) {
      console.error("Error deleting user:", error);
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: `User ${userId} deleted successfully`,
      data,
    });
  } catch (error: any) {
    console.error("Unexpected error:", error);
    return NextResponse.json(
      { error: error.message || "An unexpected error occurred" },
      { status: 500 }
    );
  }
}

