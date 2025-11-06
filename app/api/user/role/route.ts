import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getUserRole } from "@/lib/auth/get-user-role";

export async function GET(request: NextRequest) {
  try {
    // Логуємо cookies для діагностики
    const allCookies = request.cookies.getAll();
    const supabaseCookies = allCookies.filter(
      (c) => c.name.includes("supabase") || c.name.includes("sb-")
    );
    
    console.log("getUserWithRole API - cookies:", {
      totalCookies: allCookies.length,
      supabaseCookies: supabaseCookies.length,
      cookieNames: supabaseCookies.map((c) => c.name),
    });

    // Створюємо Supabase клієнт з cookies з request
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            // В API routes ми не можемо встановлювати cookies таким чином
            // Але це не критично для отримання даних
          },
        },
      }
    );

    // Спробуємо отримати сесію спочатку
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    console.log("getUserWithRole API - getSession result:", {
      hasSession: !!session,
      hasUser: !!session?.user,
      userId: session?.user?.id,
      userEmail: session?.user?.email,
      sessionError: sessionError?.message,
    });

    // Отримуємо користувача
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    console.log("getUserWithRole API - getUser result:", {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      authError: authError?.message,
    });

    // Використовуємо користувача з сесії або з getUser
    const currentUser = user || session?.user || null;

    if (!currentUser) {
      console.log("getUserWithRole - no user:", { 
        authError: authError?.message,
        sessionError: sessionError?.message,
      });
      return NextResponse.json({ user: null, role: null });
    }

    // Отримуємо роль користувача з бази даних
    const { data: userData, error: roleError } = await supabase
      .from("users")
      .select("role")
      .eq("id", currentUser.id)
      .single();

    console.log("getUserWithRole API - role query result:", {
      hasUserData: !!userData,
      role: userData?.role,
      roleError: roleError?.message,
    });

    let role = userData?.role || null;

    // Якщо ролі немає, створюємо запис з роллю за замовчуванням
    if (!role) {
      const defaultRole = "worker";
      const { error: upsertError } = await supabase
        .from("users")
        .upsert(
          {
            id: currentUser.id,
            email: currentUser.email || "",
            role: defaultRole,
          },
          {
            onConflict: "id",
          }
        );

      if (!upsertError) {
        role = defaultRole;
        console.log(`Created/updated user record with role: ${defaultRole}`);
      } else {
        console.error("Error creating/updating user record:", upsertError);
      }
    }

    const result = { user: currentUser, role };
    
    console.log("getUserWithRole", result);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Error in getUserWithRole API:", error);
    return NextResponse.json(
      { user: null, role: null, error: "Failed to get user role" },
      { status: 500 }
    );
  }
}

