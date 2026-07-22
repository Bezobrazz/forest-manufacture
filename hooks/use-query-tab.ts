"use client";

import { useCallback, useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

/**
 * Синхронізує вкладку сторінки з query-параметром URL (?tab=...).
 * Дозволяє deep-link з футера та збереження вкладки при оновленні сторінки.
 */
export function useQueryTab<T extends string>(
  allowed: readonly T[],
  defaultValue: T,
  paramKey = "tab"
): [T, (value: T) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const tab = useMemo(() => {
    const raw = searchParams.get(paramKey);
    if (raw && (allowed as readonly string[]).includes(raw)) {
      return raw as T;
    }
    return defaultValue;
  }, [searchParams, paramKey, allowed, defaultValue]);

  const setTab = useCallback(
    (value: T) => {
      const params = new URLSearchParams(searchParams.toString());
      if (value === defaultValue) {
        params.delete(paramKey);
      } else {
        params.set(paramKey, value);
      }
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams, paramKey, defaultValue]
  );

  return [tab, setTab];
}
