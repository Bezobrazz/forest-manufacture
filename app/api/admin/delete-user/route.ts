import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// ⚠️ ЦЕ ТИМЧАСОВИЙ API ROUTE ДЛЯ ВИДАЛЕННЯ КОРИСТУВАЧА
// Після використання ВИДАЛІТЬ цей файл!

export async function POST(request: Request) {
  try {
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
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Видаляємо користувача через Admin API
    const { data, error } = await supabase.auth.admin.deleteUser(userId);

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

