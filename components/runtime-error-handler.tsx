"use client";

import { useEffect } from "react";

/**
 * Компонент для обробки та приховання неважливих помилок runtime.lastError
 * від розширень браузера, які не впливають на функціональність додатку
 */
export function RuntimeErrorHandler() {
  useEffect(() => {
    // Зберігаємо оригінальний console.error
    const originalError = console.error;

    // Перевизначаємо console.error для фільтрації неважливих помилок
    console.error = (...args: any[]) => {
      const message = args[0]?.toString() || "";
      
      // Фільтруємо неважливі помилки від розширень браузера
      if (
        message.includes("runtime.lastError") ||
        message.includes("message port closed") ||
        message.includes("Extension context invalidated")
      ) {
        // Ігноруємо ці помилки, оскільки вони не впливають на функціональність
        return;
      }
      
      // Викликаємо оригінальний console.error для всіх інших помилок
      originalError.apply(console, args);
    };

    // Відновлюємо оригінальний console.error при розмонтуванні
    return () => {
      console.error = originalError;
    };
  }, []);

  return null;
}

