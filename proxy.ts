import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { UserRole } from "@/lib/auth/roles";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

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

  // Отримуємо користувача
  // Спочатку пробуємо getUser() - це оновлює сесію автоматично
  // Потім getSession() якщо потрібно
  const {
    data: { user: userFromGetUser },
    error: getUserError,
  } = await supabase.auth.getUser();

  // Якщо getUser() знайшов користувача, використовуємо його
  // Якщо ні, пробуємо getSession()
  let user: { id: string } | null = userFromGetUser ?? null;
  let session = null;

  if (!user) {
    const {
      data: { session: sessionData },
    } = await supabase.auth.getSession();
    session = sessionData;
    user = session?.user ?? null;
  } else {
    // Якщо користувач є, отримуємо сесію для діагностики
    const {
      data: { session: sessionData },
    } = await supabase.auth.getSession();
    session = sessionData;
  }

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

  const currentPath = request.nextUrl.pathname;

  // Перевіряємо, чи це захищений роут
  // Виключаємо /auth та / (головна сторінка)
  const isProtectedPath =
    protectedPaths.some((path) => currentPath.startsWith(path)) &&
    !currentPath.startsWith("/auth") &&
    currentPath !== "/";

  // Діагностика (можна видалити після виправлення)
  if (process.env.NODE_ENV === "development" && isProtectedPath) {
    const allCookies = request.cookies.getAll();
    const supabaseCookies = allCookies.filter(
      (c) => c.name.includes("supabase") || c.name.includes("sb-")
    );

    console.log("[Middleware] Protected path check:", {
      path: currentPath,
      isProtectedPath,
      hasSession: !!session,
      hasUser: !!user,
      userId: user?.id || null,
      getUserError: getUserError?.message || null,
      cookiesCount: supabaseCookies.length,
      cookieNames: supabaseCookies.map((c) => c.name),
    });
  }

  // Якщо вже на сторінці авторизації - не робимо нічого
  if (
    currentPath.startsWith("/auth/login") ||
    currentPath.startsWith("/auth/signup")
  ) {
    // Якщо користувач вже авторизований, перенаправляємо на головну
    if (user && currentPath !== "/") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/";
      redirectUrl.searchParams.delete("redirectedFrom");
      return NextResponse.redirect(redirectUrl);
    }
    // Якщо не авторизований - дозволяємо залишитися на сторінці логіну
    return response;
  }

  // Якщо користувач не авторизований і намагається зайти на захищений маршрут
  if (isProtectedPath && !user) {
    // Діагностика: логуємо, чому користувач не авторизований
    if (process.env.NODE_ENV === "development") {
      const allCookies = request.cookies.getAll();
      const supabaseCookies = allCookies.filter(
        (c) => c.name.includes("supabase") || c.name.includes("sb-")
      );

      console.log("[Middleware] Redirecting to login:", {
        path: currentPath,
        isProtectedPath,
        hasSession: !!session,
        sessionUserId: session?.user?.id ?? null,
        hasUser: !!user,
        userId: (user as { id: string } | null)?.id ?? null,
        cookiesCount: supabaseCookies.length,
        cookieNames: supabaseCookies.map((c) => c.name),
      });
    }

    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth/login";
    redirectUrl.searchParams.set("redirectedFrom", currentPath);
    return NextResponse.redirect(redirectUrl);
  }

  // Якщо користувач авторизований, перевіряємо та створюємо запис з роллю, якщо його немає
  if (user) {
    // Перевіряємо, чи є запис в public.users з роллю
    try {
      const { data: userData, error } = await supabase
        .from("users")
        .select("role")
        .eq("id", user.id)
        .single();

      // Якщо запису немає або ролі немає, створюємо/оновлюємо запис
      if (error || !userData || !userData.role) {
        // Отримуємо email користувача з auth.users
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser();

        if (authUser) {
          // Створюємо або оновлюємо запис з роллю за замовчуванням
          const defaultRole: UserRole = "worker";
          await supabase
            .from("users")
            .upsert(
              {
                id: user.id,
                email: authUser.email || "",
                role: defaultRole,
              },
              {
                onConflict: "id",
              }
            );
        }
      }
    } catch (error) {
      // Якщо помилка - логуємо, але не блокуємо
      console.error("Error ensuring user record exists:", error);
    }
  }

  // Якщо користувач авторизований, перевіряємо роль
  // АЛЕ тільки для роутів, де потрібна конкретна роль (не всі ролі)
  if (isProtectedPath && user) {
    // Знаходимо відповідний роут та його вимоги до ролі
    const matchedRoute = Object.keys(routePermissions).find((path) =>
      currentPath.startsWith(path)
    );

    if (matchedRoute) {
      const allowedRoles = routePermissions[matchedRoute];

      // Якщо всі ролі дозволені (всі авторизовані), пропускаємо перевірку
      // Перевіряємо тільки для роутів з обмеженнями (менше 3 ролей)
      if (allowedRoles.length < 3) {
        try {
          // Отримуємо роль користувача з бази даних
          const { data: userData, error } = await supabase
            .from("users")
            .select("role, email")
            .eq("id", user.id)
            .single();

          // Якщо запису немає або ролі немає, створюємо/оновлюємо запис
          if (error || !userData || !userData.role) {
            // Отримуємо email користувача з auth.users
            const {
              data: { user: authUser },
            } = await supabase.auth.getUser();

            if (authUser) {
              // Створюємо або оновлюємо запис з роллю за замовчуванням
              const defaultRole: UserRole = "worker";
              const { error: upsertError } = await supabase
                .from("users")
                .upsert(
                  {
                    id: user.id,
                    email: authUser.email || "",
                    role: defaultRole,
                  },
                  {
                    onConflict: "id",
                  }
                );

              if (upsertError) {
                console.warn("Could not create/update user record:", upsertError.message);
                // Пропускаємо перевірку, дозволяємо доступ
                return response;
              }

              // Після створення запису, перевіряємо роль
              const userRole = defaultRole;
              if (!allowedRoles.includes(userRole)) {
                const redirectUrl = request.nextUrl.clone();
                redirectUrl.pathname = "/";
                redirectUrl.searchParams.set("error", "access_denied");
                return NextResponse.redirect(redirectUrl);
              }
            } else {
              // Якщо не вдалося отримати користувача, дозволяємо доступ
              return response;
            }
          } else {
            // Якщо запис є і роль є, перевіряємо доступ
            const userRole = userData.role as UserRole;

            // Перевіряємо, чи користувач має дозволену роль
            if (!allowedRoles.includes(userRole)) {
              // Якщо немає доступу, перенаправляємо на головну з повідомленням
              const redirectUrl = request.nextUrl.clone();
              redirectUrl.pathname = "/";
              redirectUrl.searchParams.set("error", "access_denied");
              return NextResponse.redirect(redirectUrl);
            }
          }
        } catch (error) {
          // Якщо критична помилка - логуємо, але не блокуємо
          console.error("Error checking user role:", error);
          // Пропускаємо перевірку, щоб не блокувати користувача
          return response;
        }
      }
      // Якщо всі ролі дозволені, просто пропускаємо
    }
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
