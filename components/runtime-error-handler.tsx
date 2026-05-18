"use client";

import { useEffect } from "react";

const EXTENSION_NOISE_PATTERNS = [
  "runtime.lastError",
  "message port closed",
  "message channel closed",
  "Extension context invalidated",
  "asynchronous response by returning true",
] as const;

const isExtensionNoise = (message: string) =>
  EXTENSION_NOISE_PATTERNS.some((pattern) => message.includes(pattern));

/**
 * Приховує неважливі помилки від розширень браузера (Chrome messaging),
 * які не впливають на функціональність додатку.
 */
export function RuntimeErrorHandler() {
  useEffect(() => {
    const originalError = console.error;

    console.error = (...args: unknown[]) => {
      const message = String(args[0] ?? "");
      if (isExtensionNoise(message)) return;
      originalError.apply(console, args);
    };

    const onUnhandledRejection = (event: PromiseRejectionEvent) => {
      const reason = event.reason;
      const message =
        reason instanceof Error
          ? reason.message
          : typeof reason === "string"
            ? reason
            : String(reason ?? "");
      if (isExtensionNoise(message)) {
        event.preventDefault();
      }
    };

    window.addEventListener("unhandledrejection", onUnhandledRejection);

    return () => {
      console.error = originalError;
      window.removeEventListener("unhandledrejection", onUnhandledRejection);
    };
  }, []);

  return null;
}

