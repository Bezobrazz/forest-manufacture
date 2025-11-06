import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { getDefaultRole } from "@/lib/auth/roles";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const forwardedHost = request.headers.get("x-forwarded-host");
    const isLocalEnv = process.env.NODE_ENV === "development";
    const redirectUrl = isLocalEnv
      ? `${origin}${next}`
      : forwardedHost
      ? `https://${forwardedHost}${next}`
      : `${origin}${next}`;

    let response = NextResponse.redirect(redirectUrl);

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

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Після успішного обміну коду на сесію, перевіряємо та створюємо запис в public.users
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Перевіряємо, чи існує запис в public.users
        const { data: existingUser, error: fetchError } = await supabase
          .from("users")
          .select("id, role")
          .eq("id", user.id)
          .single();

        // Якщо запису немає, створюємо його з роллю за замовчуванням
        if (fetchError || !existingUser) {
          const defaultRole = getDefaultRole();
          const { error: insertError } = await supabase
            .from("users")
            .insert({
              id: user.id,
              role: defaultRole,
              email: user.email || "",
            })
            .select()
            .single();

          if (insertError) {
            console.error("Error creating user record:", insertError);
            // Не блокуємо редірект, але логуємо помилку
          } else {
            console.log(`Created user record with role: ${defaultRole}`);
          }
        } else if (!existingUser.role) {
          // Якщо запис є, але ролі немає, встановлюємо роль за замовчуванням
          const defaultRole = getDefaultRole();
          const { error: updateError } = await supabase
            .from("users")
            .update({ role: defaultRole })
            .eq("id", user.id);

          if (updateError) {
            console.error("Error updating user role:", updateError);
          } else {
            console.log(`Updated user role to: ${defaultRole}`);
          }
        }
      }

      return response;
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_failed`);
}
