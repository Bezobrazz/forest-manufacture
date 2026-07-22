import { openai } from "@ai-sdk/openai";

/** Дешевша модель для структурованих автоінсайтів. */
export const insightsModel = openai("gpt-4o-mini");

/** Сильніша модель для чат-аналітики. */
export const chatModel = openai("gpt-4o");
