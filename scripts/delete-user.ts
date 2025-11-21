#!/usr/bin/env ts-node
/**
 * Скрипт для видалення користувача з Supabase
 * 
 * Використання:
 *   npx tsx scripts/delete-user.ts <user-id>
 * 
 * Або додайте в package.json:
 *   "delete-user": "tsx scripts/delete-user.ts"
 */

import { createClient } from "@supabase/supabase-js";

const userId = process.argv[2];

if (!userId) {
  console.error("❌ Помилка: Потрібен User ID");
  console.log("\nВикористання:");
  console.log("  npx tsx scripts/delete-user.ts <user-id>");
  console.log("\nПриклад:");
  console.log("  npx tsx scripts/delete-user.ts 9bf55386-9d41-412a-85ce-e7bbbd226ccb");
  process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("❌ Помилка: Змінні середовища не налаштовані");
  console.log("\nДодайте в .env.local:");
  console.log("  NEXT_PUBLIC_SUPABASE_URL=https://eqidflcnkaqdglfhqxph.supabase.co");
  console.log("  SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here");
  process.exit(1);
}

async function deleteUser() {
  console.log(`🔄 Видалення користувача: ${userId}...`);

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  try {
    const { data, error } = await supabase.auth.admin.deleteUser(userId);

    if (error) {
      console.error("❌ Помилка:", error.message);
      process.exit(1);
    }

    console.log("✅ Користувач успішно видалений!");
    console.log("📋 Дані:", JSON.stringify(data, null, 2));
  } catch (error: any) {
    console.error("❌ Несподівана помилка:", error.message);
    process.exit(1);
  }
}

deleteUser();






