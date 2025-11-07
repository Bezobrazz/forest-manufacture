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
// Використовуємо @supabase/ssr для уніфікованого підходу з middleware
let browserClientInstance: ReturnType<typeof createSSRBrowserClient> | null = null

// Створюємо клієнт Supabase для клієнтського використання
// ВАЖЛИВО: Використовуємо @supabase/ssr для сумісності з middleware
// Це дозволяє зберігати сесію в cookies, які доступні як на клієнті, так і на сервері
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

  // Використовуємо @supabase/ssr для роботи з cookies
  // Це забезпечує сумісність між клієнтом і сервером (middleware)
  browserClientInstance = createSSRBrowserClient(supabaseUrl, supabaseKey, {
    cookies: {
      get(name: string) {
        // Отримуємо cookie з document.cookie
        const value = document.cookie
          .split('; ')
          .find(row => row.startsWith(`${name}=`))
          ?.split('=')[1];
        return value || null;
      },
      set(name: string, value: string, options: any) {
        // Встановлюємо cookie через document.cookie
        let cookie = `${name}=${value}`;
        
        if (options?.maxAge) {
          cookie += `; max-age=${options.maxAge}`;
        }
        if (options?.path) {
          cookie += `; path=${options.path}`;
        }
        if (options?.domain) {
          cookie += `; domain=${options.domain}`;
        }
        if (options?.sameSite) {
          cookie += `; samesite=${options.sameSite}`;
        }
        if (options?.secure) {
          cookie += '; secure';
        }
        
        document.cookie = cookie;
      },
      remove(name: string, options: any) {
        // Видаляємо cookie шляхом встановлення maxAge в 0
        let cookie = `${name}=; max-age=0`;
        
        if (options?.path) {
          cookie += `; path=${options.path}`;
        }
        if (options?.domain) {
          cookie += `; domain=${options.domain}`;
        }
        
        document.cookie = cookie;
      },
    },
  })
  return browserClientInstance
}

