# Контроль доступу на основі ролей

## Ролі користувачів

- **`owner`** - Власник системи (повний доступ)
- **`admin`** - Адміністратор (доступ до більшості функцій)
- **`worker`** - Працівник (обмежений доступ)

## Структура файлів

### `lib/auth/roles.ts`
- Типи ролей
- Функції перевірки ролей
- Ієрархія ролей

### `lib/auth/get-user-role.ts`
- Отримання ролі користувача з бази даних
- Функція `getUserRole(userId)` - отримує роль користувача
- Функція `getUserWithRole()` - отримує користувача та роль одночасно

### `lib/auth/require-role.ts`
- Функції для Server Components та Server Actions
- `requireRole(allowedRoles)` - вимагає певну роль
- `requireAuth()` - вимагає авторизацію

### `middleware.ts`
- Перевірка доступу на рівні маршрутів
- Автоматичне перенаправлення при відсутності доступу

## Налаштування доступу до роутів

Доступ налаштовується в `middleware.ts` в об'єкті `routePermissions`:

```typescript
const routePermissions: Record<string, UserRole[]> = {
  // Адмін роути - тільки для owner та admin
  "/dashboard/users": ["owner", "admin"],
  "/api/admin": ["owner", "admin"],
  
  // Роути для всіх авторизованих користувачів
  "/dashboard": ["owner", "admin", "worker"],
  "/shifts": ["owner", "admin", "worker"],
  // ...
};
```

## Використання в Server Components

```typescript
import { requireRole } from '@/lib/auth/require-role';

export default async function AdminPage() {
  // Перевірка, що користувач має роль owner або admin
  const { user, role } = await requireRole(['owner', 'admin']);
  
  // Якщо роль не відповідає, користувач буде перенаправлений
  
  return <div>Admin content</div>;
}
```

## Використання в Server Actions

```typescript
'use server';

import { requireRole } from '@/lib/auth/require-role';

export async function deleteUser(userId: string) {
  // Перевірка ролі
  const { user, role } = await requireRole(['owner', 'admin']);
  
  // Виконання дії
  // ...
}
```

## Використання в API Routes

```typescript
import { getUserRole } from '@/lib/auth/get-user-role';
import { createServerSupabaseClient } from '@/lib/supabase/server-auth';

export async function POST(request: Request) {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  
  const userRole = await getUserRole(user.id);
  if (!userRole || userRole !== 'owner') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  
  // Виконання дії
}
```

## Використання в Client Components

```typescript
'use client';

import { useEffect, useState } from 'react';
import { getUserRole } from '@/lib/auth/get-user-role';

export default function MyComponent() {
  const [role, setRole] = useState<string | null>(null);
  
  useEffect(() => {
    async function fetchRole() {
      const { user, role } = await getUserWithRole();
      setRole(role);
    }
    fetchRole();
  }, []);
  
  if (role === 'owner' || role === 'admin') {
    return <AdminButton />;
  }
  
  return null;
}
```

## Додавання нового роуту з обмеженням доступу

1. Додайте роут в `routePermissions` в `middleware.ts`:

```typescript
const routePermissions = {
  // ... існуючі роути
  "/new-route": ["owner", "admin"], // Тільки для owner та admin
};
```

2. Якщо потрібна перевірка в Server Component:

```typescript
import { requireRole } from '@/lib/auth/require-role';

export default async function NewRoutePage() {
  await requireRole(['owner', 'admin']);
  // ...
}
```

## Приклади налаштування доступу

### Всі авторизовані користувачі
```typescript
"/route": ["owner", "admin", "worker"]
```

### Тільки адміністратори
```typescript
"/admin-route": ["owner", "admin"]
```

### Тільки власник
```typescript
"/owner-route": ["owner"]
```

### Тільки працівники (і вище)
```typescript
"/worker-route": ["owner", "admin", "worker"]
```

## Обробка помилок доступу

Якщо користувач не має доступу:
- Middleware автоматично перенаправляє на головну сторінку з параметром `?error=access_denied`
- Можна показати повідомлення про відсутність доступу


