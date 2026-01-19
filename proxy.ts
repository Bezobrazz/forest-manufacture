import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { UserRole } from "@/lib/auth/roles";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const currentPath = request.nextUrl.pathname;

  // Швидка перевірка - якщо це публічний ресурс, не робимо нічого
  if (
    currentPath.startsWith("/_next") ||
    currentPath.startsWith("/api/auth") ||
    currentPath === "/favicon.ico" ||
    /\.(svg|png|jpg|jpeg|gif|webp)$/.test(currentPath)
  ) {
    return response;
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Визначення роутів та їх вимог до ролей
  const routePermissions: Record<string, UserRole[]> = {
    // Адмін роути - тільки для owner та admin
    "/dashboard/users": ["owner", "admin"],
    "/api/admin": ["owner", "admin"],

    // Роути для всіх авторизованих користувачів
    "/dashboard": ["owner", "admin", "worker"],
    "/shifts": ["owner", "admin", "worker"],
    "/employees": ["owner", "admin", "worker"],
    "/products": ["owner", "admin", "worker"],
    "/inventory": ["owner", "admin", "worker"],
    "/tasks": ["owner", "admin", "worker"],
    "/statistics": ["owner", "admin", "worker"],
    "/expenses": ["owner", "admin", "worker"],
    "/user": ["owner", "admin", "worker"],
  };

  // Захищені маршрути - потребують авторизації
  const protectedPaths = Object.keys(routePermissions);

  // Перевіряємо, чи це захищений роут
  // Виключаємо /auth та / (головна сторінка)
  const isProtectedPath =
    protectedPaths.some((path) => currentPath.startsWith(path)) &&
    !currentPath.startsWith("/auth") &&
    currentPath !== "/";

  // Якщо вже на сторінці авторизації
  if (
    currentPath.startsWith("/auth/login") ||
    currentPath.startsWith("/auth/signup")
  ) {
    // Перевіряємо, чи користувач вже авторизований (тільки якщо потрібно)
    // Використовуємо getSession() - швидше для простих перевірок
    const {
      data: { session },
    } = await supabase.auth.getSession();

    if (session?.user && currentPath !== "/") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/";
      redirectUrl.searchParams.delete("redirectedFrom");
      return NextResponse.redirect(redirectUrl);
    }
    return response;
  }

  // Якщо це не захищений роут, пропускаємо
  if (!isProtectedPath) {
    return response;
  }

  // Для захищених роутів - отримуємо користувача (тільки один виклик)
  // Використовуємо getUser() - він автоматично оновлює сесію
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Якщо користувач не авторизований і намагається зайти на захищений маршрут
  if (!user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth/login";
    redirectUrl.searchParams.set("redirectedFrom", currentPath);
    return NextResponse.redirect(redirectUrl);
  }

  // Знаходимо відповідний роут та його вимоги до ролі
  const matchedRoute = Object.keys(routePermissions).find((path) =>
    currentPath.startsWith(path)
  );

  if (!matchedRoute) {
    return response;
  }

  const allowedRoles = routePermissions[matchedRoute];

  // Якщо всі ролі дозволені (всі авторизовані), пропускаємо перевірку
  if (allowedRoles.length >= 3) {
    return response;
  }

  // Перевіряємо роль тільки для роутів з обмеженнями
  try {
    // Отримуємо роль користувача з бази даних (тільки один запит)
    const { data: userData, error: userDataError } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    let userRole: UserRole | null = null;

    // Якщо запису немає або ролі немає, створюємо/оновлюємо запис
    if (userDataError || !userData || !userData.role) {
      // Використовуємо вже отриманого користувача з getUser()
      const defaultRole: UserRole = "worker";
      const { error: upsertError } = await supabase
        .from("users")
        .upsert(
          {
            id: user.id,
            email: user.email || "",
            role: defaultRole,
          },
          {
            onConflict: "id",
          }
        );

      if (upsertError) {
        // Якщо не вдалося створити запис, дозволяємо доступ (не блокуємо)
        console.warn("Could not create/update user record:", upsertError.message);
        return response;
      }

      userRole = defaultRole;
    } else {
      userRole = userData.role as UserRole;
    }

    // Перевіряємо, чи користувач має дозволену роль
    if (userRole && !allowedRoles.includes(userRole)) {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/";
      redirectUrl.searchParams.set("error", "access_denied");
      return NextResponse.redirect(redirectUrl);
    }
  } catch (error) {
    // Якщо критична помилка - логуємо, але не блокуємо
    console.error("Error checking user role:", error);
    // Пропускаємо перевірку, щоб не блокувати користувача
    return response;
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
