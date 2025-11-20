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

  // Отримуємо компоненти дати з UTC, щоб уникнути зміни дати через часовий пояс
  // Дата вже зберігається в UTC, тому використовуємо UTC методи для отримання компонентів
  let day = date.getUTCDate();
  let month = date.getUTCMonth();
  let year = date.getUTCFullYear();
  let hours = date.getUTCHours();
  let minutes = date.getUTCMinutes();
  
  // Визначаємо, чи зараз літній час в Україні для правильного відображення часу
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

  // Додаємо зсув часового поясу тільки до часу
  const offsetHours = isUkrainianDST() ? 3 : 2;
  hours = hours + offsetHours;
  
  // Якщо години перевищують 23, переходимо на наступний день
  if (hours >= 24) {
    hours = hours - 24;
    day = day + 1;
    
    // Перевіряємо, чи не перейшли на наступний місяць
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    if (day > daysInMonth) {
      day = 1;
      month = month + 1;
      
      // Перевіряємо, чи не перейшли на наступний рік
      if (month > 11) {
        month = 0;
        year = year + 1;
      }
    }
  }
  
  // Форматуємо компоненти
  const dayStr = day.toString().padStart(2, "0");
  const monthStr = (month + 1).toString().padStart(2, "0");
  const yearStr = year.toString();
  const hoursStr = hours.toString().padStart(2, "0");
  const minutesStr = minutes.toString().padStart(2, "0");

  return `${dayStr}.${monthStr}.${yearStr} ${hoursStr}:${minutesStr}`;
}

/**
 * Отримує номер тижня з дати, де тиждень починається з суботи і закінчується п'ятницею
 * @param date Дата
 * @returns Номер тижня
 */
export function getWeekNumber(date: Date): number {
  // Встановлюємо початок року
  const firstDayOfYear = new Date(date.getFullYear(), 0, 1);

  // Визначаємо першу суботу року
  const firstSaturday = new Date(firstDayOfYear);
  const dayOfWeek = firstDayOfYear.getDay();
  const diff = dayOfWeek === 6 ? 0 : 6 - dayOfWeek; // Якщо субота (6), не зміщуємо, інакше до наступної суботи
  firstSaturday.setDate(firstDayOfYear.getDate() + diff);

  // Якщо дата раніше першої суботи року, повертаємо 1
  if (date < firstSaturday) {
    return 1;
  }

  // Розраховуємо кількість тижнів від першої суботи
  const pastDays = Math.floor(
    (date.getTime() - firstSaturday.getTime()) / (24 * 60 * 60 * 1000)
  );
  return Math.floor(pastDays / 7) + 1;
}

/**
 * Форматує число з українською локалізацією
 * @param value Число для форматування
 * @param options Опції форматування
 * @returns Відформатоване число
 */
export function formatNumber(
  value: number,
  options: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    useGrouping?: boolean;
  } = {}
): string {
  const {
    minimumFractionDigits = 0,
    maximumFractionDigits = 2,
    useGrouping = true,
  } = options;

  return new Intl.NumberFormat("uk-UA", {
    minimumFractionDigits,
    maximumFractionDigits,
    useGrouping,
  }).format(value);
}

/**
 * Форматує число з одиницями вимірювання
 * @param value Число для форматування
 * @param unit Одиниця вимірювання
 * @param options Опції форматування
 * @returns Відформатоване число з одиницею
 */
export function formatNumberWithUnit(
  value: number,
  unit: string,
  options: {
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
    useGrouping?: boolean;
  } = {}
): string {
  const formattedNumber = formatNumber(value, options);
  return `${formattedNumber} ${unit}`;
}

/**
 * Форматує відсотки з українською локалізацією
 * @param value Значення відсотка (0-100)
 * @param decimalPlaces Кількість знаків після коми
 * @returns Відформатований відсоток
 */
export function formatPercentage(
  value: number,
  decimalPlaces: number = 1
): string {
  return (
    new Intl.NumberFormat("uk-UA", {
      minimumFractionDigits: decimalPlaces,
      maximumFractionDigits: decimalPlaces,
    }).format(value) + "%"
  );
}
