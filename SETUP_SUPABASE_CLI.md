# Налаштування Supabase CLI для роботи з Cursor

## Швидке налаштування (5 хвилин)

### Крок 1: Встановіть Supabase CLI

```bash
npm install -g supabase
```

Або через Homebrew (macOS):
```bash
brew install supabase/tap/supabase
```

### Крок 2: Увійдіть в Supabase

```bash
supabase login
```

Це відкриє браузер для автентифікації.

### Крок 3: Підключіть проект

```bash
cd /Users/viacheslavkostenko/Desktop/Projects/forest-manufacture
supabase link --project-ref eqidflcnkaqdglfhqxph
```

### Крок 4: Додайте Service Role Key в .env.local

1. Отримайте Service Role Key:
   - Відкрийте [Supabase Dashboard](https://supabase.com/dashboard)
   - Виберіть проект: `eqidflcnkaqdglfhqxph`
   - Перейдіть: **Settings** → **API**
   - Знайдіть **service_role** key (secret)
   - Скопіюйте його

2. Додайте в `.env.local`:
```env
NEXT_PUBLIC_SUPABASE_URL=https://eqidflcnkaqdglfhqxph.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**⚠️ ВАЖЛИВО:** Додайте `.env.local` в `.gitignore`, щоб не публікувати ключі!

### Крок 5: Встановіть залежності для скриптів

```bash
npm install --save-dev tsx @types/node
```

### Готово! Тепер можна використовувати:

#### Варіант 1: Через API Route (Найпростіше)

1. Створіть `.env.local` з Service Role Key (якщо ще не створили)
2. Запустіть сервер:
```bash
npm run dev
```
3. Виконайте запит:
```bash
curl -X POST http://localhost:3000/api/admin/delete-user \
  -H "Content-Type: application/json" \
  -d '{"userId": "9bf55386-9d41-412a-85ce-e7bbbd226ccb"}'
```

#### Варіант 2: Через скрипт

```bash
npx tsx scripts/delete-user.ts 9bf55386-9d41-412a-85ce-e7bbbd226ccb
```

#### Варіант 3: Через Supabase CLI

```bash
# Виконати SQL напряму
supabase db execute --file supabase/migrations/20241221000001_fix_confirmation_token_null.sql

# Або через SQL Editor в Dashboard
```

## Використання в Cursor

Після налаштування я можу:

1. **Виконати команди через термінал** - використовуючи `run_terminal_cmd`
2. **Викликати API routes** - якщо сервер запущений
3. **Виконати SQL скрипти** - через Supabase CLI

### Приклад виконання команди видалення користувача:

Я можу виконати:
```bash
npx tsx scripts/delete-user.ts 9bf55386-9d41-412a-85ce-e7bbbd226ccb
```

Або викликати API:
```bash
curl -X POST http://localhost:3000/api/admin/delete-user \
  -H "Content-Type: application/json" \
  -d '{"userId": "9bf55386-9d41-412a-85ce-e7bbbd226ccb"}'
```

## Безпека

⚠️ **ВАЖЛИВО:**
- Service Role Key має повний доступ до бази даних
- НЕ публікуйте його в GitHub
- Додайте `.env.local` в `.gitignore`
- Після використання видаліть тимчасові API routes

## Додаткові команди

### Перевірка підключення
```bash
supabase projects list
```

### Виконання SQL
```bash
supabase db execute --file path/to/script.sql
```

### Перегляд міграцій
```bash
supabase migration list
```

## Допомога

Якщо щось не працює:
1. Перевірте, що Service Role Key правильний
2. Перевірте, що `.env.local` існує і має правильні значення
3. Переконайтеся, що Supabase CLI встановлено: `supabase --version`





