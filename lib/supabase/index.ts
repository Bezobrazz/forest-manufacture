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

// Створюємо клієнт Supabase для клієнтського використання з підтримкою cookies
// Використовуємо @supabase/ssr для правильної роботи з cookies та middleware
export function createBrowserClient() {
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

  // Використовуємо createBrowserClient з @supabase/ssr для правильної роботи з cookies
  return createSSRBrowserClient(supabaseUrl, supabaseKey)
}

