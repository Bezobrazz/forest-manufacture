import { createClient } from "@supabase/supabase-js"
import { createBrowserClient as createSSRBrowserClient } from "@supabase/ssr"

// Створюємо клієнт Supabase для серверного використання з кращою обробкою помилок
export function createServerClient() {
  // Перевіряємо наявність змінних середовища
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase credentials are missing:", {
      urlExists: !!supabaseUrl,
      keyExists: !!supabaseKey,
      envKeys: Object.keys(process.env).filter((key) => key.includes("SUPABASE")),
    })

    // Повертаємо заглушку клієнта, щоб уникнути помилок при виклику методів
    return {
      from: () => ({
        select: () => ({
          order: () => ({
            then: () => Promise.resolve({ data: [], error: new Error("Supabase credentials are missing") }),
          }),
          eq: () => ({
            then: () => Promise.resolve({ data: [], error: new Error("Supabase credentials are missing") }),
          }),
          single: () => ({
            then: () => Promise.resolve({ data: null, error: new Error("Supabase credentials are missing") }),
          }),
        }),
        insert: () => ({
          select: () => ({
            then: () => Promise.resolve({ data: [], error: new Error("Supabase credentials are missing") }),
          }),
        }),
        update: () => ({
          eq: () => ({
            then: () => Promise.resolve({ data: [], error: new Error("Supabase credentials are missing") }),
          }),
          select: () => ({
            then: () => Promise.resolve({ data: [], error: new Error("Supabase credentials are missing") }),
          }),
        }),
        delete: () => ({
          eq: () => ({
            then: () => Promise.resolve({ data: [], error: new Error("Supabase credentials are missing") }),
          }),
        }),
        upsert: () => ({
          then: () => Promise.resolve({ data: [], error: new Error("Supabase credentials are missing") }),
        }),
      }),
    } as any
  }

  try {
    return createClient(supabaseUrl, supabaseKey)
  } catch (error) {
    console.error("Error creating Supabase client:", error)
    throw error
  }
}

// Singleton для клієнтського клієнта Supabase
// Використовуємо звичайний createClient для клієнтських компонентів,
// оскільки він має вбудовану логіку для уникнення множинних екземплярів через localStorage
let browserClientInstance: ReturnType<typeof createClient> | null = null

// Створюємо клієнт Supabase для клієнтського використання
// Використовуємо singleton pattern, щоб уникнути множинних екземплярів GoTrueClient
// Для клієнтських компонентів використовуємо звичайний createClient,
// який автоматично керує екземплярами через localStorage
export function createBrowserClient() {
  // Перевіряємо, чи ми в браузерному середовищі
  if (typeof window === "undefined") {
    throw new Error("createBrowserClient can only be used in browser environment")
  }

  // Якщо клієнт вже створений, повертаємо існуючий екземпляр
  if (browserClientInstance) {
    return browserClientInstance
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error("Supabase client credentials are missing:", {
      urlExists: !!supabaseUrl,
      keyExists: !!supabaseKey,
      envKeys: Object.keys(process.env).filter((key) => key.includes("SUPABASE")),
    })
    throw new Error("Supabase client credentials are missing")
  }

  // Створюємо новий екземпляр тільки один раз
  // Використовуємо звичайний createClient, який має вбудовану логіку
  // для уникнення множинних екземплярів через localStorage
  browserClientInstance = createClient(supabaseUrl, supabaseKey, {
    auth: {
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
    },
  })
  return browserClientInstance
}

