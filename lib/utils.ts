import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatDate(dateString: string) {
  const date = new Date(dateString);
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear().toString().slice(-2);
  return `${day}.${month}.${year}`;
}

// Додамо нову функцію для форматування дати з часом
export function formatDateTime(dateString: string): string {
  if (!dateString) return "";

  const date = new Date(dateString);

  // Перевіряємо, чи дата валідна
  if (isNaN(date.getTime())) return dateString;

  // Встановлюємо український часовий пояс (UTC+2, або UTC+3 влітку)
  // Визначаємо, чи зараз літній час в Україні
  const isUkrainianDST = () => {
    // Літній час в Україні: остання неділя березня - остання неділя жовтня
    const year = date.getUTCFullYear();

    // Остання неділя березня
    const marchLastSunday = new Date(Date.UTC(year, 2, 31));
    marchLastSunday.setUTCDate(31 - marchLastSunday.getUTCDay());

    // Остання неділя жовтня
    const octoberLastSunday = new Date(Date.UTC(year, 9, 31));
    octoberLastSunday.setUTCDate(31 - octoberLastSunday.getUTCDay());

    // Перевіряємо, чи поточна дата в межах літнього часу
    return date >= marchLastSunday && date < octoberLastSunday;
  };

  // Зсув часового поясу в мілісекундах (UTC+2 або UTC+3)
  const offsetMs = (isUkrainianDST() ? 3 : 2) * 60 * 60 * 1000;

  // Створюємо нову дату з урахуванням українського часового поясу
  const ukrainianDate = new Date(date.getTime() + offsetMs);

  // Форматуємо дату у вигляді "DD.MM.YYYY HH:MM"
  const day = ukrainianDate.getUTCDate().toString().padStart(2, "0");
  const month = (ukrainianDate.getUTCMonth() + 1).toString().padStart(2, "0");
  const year = ukrainianDate.getUTCFullYear();
  const hours = ukrainianDate.getUTCHours().toString().padStart(2, "0");
  const minutes = ukrainianDate.getUTCMinutes().toString().padStart(2, "0");

  return `${day}.${month}.${year} ${hours}:${minutes}`;
}

/**
 * Отримує номер тижня з дати, де тиждень починається з понеділка
 * @param date Дата
 * @returns Номер тижня
 */
export function getWeekNumber(date: Date): number {
  // Встановлюємо початок року
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);

  // Визначаємо понеділок першого тижня року
  const firstMonday = new Date(firstDayOfYear);
  const dayOfWeek = firstDayOfYear.getDay();
  const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Якщо неділя (0), відступаємо на 6 днів назад
  firstMonday.setDate(firstDayOfYear.getDate() + diff);

  // Якщо дата раніше першого понеділка року, повертаємо 1
  if (date < firstMonday) {
    return 1;
  }

  // Розраховуємо кількість тижнів від першого понеділка
  const pastDays = Math.floor(
    (date.getTime() - firstMonday.getTime()) / (24 * 60 * 60 * 1000)
  );
  return Math.floor(pastDays / 7) + 1;
}
