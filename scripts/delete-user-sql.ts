#!/usr/bin/env tsx
/**
 * Скрипт для видалення користувача через прямий SQL запит
 * Обходить проблему з NULL confirmation_token
 */

import { createClient } from "@supabase/supabase-js";

const userId = process.argv[2] || '9bf55386-9d41-412a-85ce-e7bbbd226ccb';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Помилка: Змінні середовища не налаштовані");
  console.log("\nДодайте в .env.local:");
  console.log("  NEXT_PUBLIC_SUPABASE_URL=https://eqidflcnkaqdglfhqxph.supabase.co");
  console.log("  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here");
  process.exit(1);
}

async function deleteUserViaSQL() {
  console.log(`🔄 Видалення користувача через SQL: ${userId}...`);

  // Створюємо клієнт з Service Role Key для прямого доступу до REST API
  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    // Виконуємо прямий SQL запит через REST API
    const { data, error } = await supabase.rpc('exec_sql', {
      query: `DELETE FROM auth.users WHERE id = '${userId}' AND confirmation_token IS NULL;`
    });

    if (error) {
      // Якщо RPC не працює, спробуємо через REST API напряму
      console.log("⚠️ RPC не працює, спробуємо через REST API...");
      
      // Використовуємо прямий REST API виклик
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'apikey': serviceRoleKey,
          'Authorization': `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          query: `DELETE FROM auth.users WHERE id = '${userId}' AND confirmation_token IS NULL;`
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("❌ Помилка REST API:", errorText);
        
        // Останній варіант - використати Admin API з обходом
        console.log("\n🔄 Спробуємо альтернативний метод...");
        console.log("\n📋 Інструкції:");
        console.log("1. Відкрийте Supabase Dashboard → SQL Editor");
        console.log("2. Виконайте цей SQL:");
        console.log(`\nDELETE FROM auth.users WHERE id = '${userId}' AND confirmation_token IS NULL;\n`);
        console.log("Або використайте файл: scripts/delete-user-direct.sql");
        
        process.exit(1);
      }

      const result = await response.json();
      console.log("✅ Користувач успішно видалений через REST API!");
      console.log("📋 Результат:", JSON.stringify(result, null, 2));
    } else {
      console.log("✅ Користувач успішно видалений!");
      console.log("📋 Дані:", JSON.stringify(data, null, 2));
    }
  } catch (error: any) {
    console.error("❌ Несподівана помилка:", error.message);
    console.log("\n📋 Альтернативне рішення:");
    console.log("1. Відкрийте Supabase Dashboard → SQL Editor");
    console.log("2. Виконайте SQL з файлу: scripts/delete-user-direct.sql");
    console.log("3. Або скопіюйте цей SQL:");
    console.log(`\nDELETE FROM auth.users WHERE id = '${userId}' AND confirmation_token IS NULL;\n`);
    process.exit(1);
  }
}

deleteUserViaSQL();








