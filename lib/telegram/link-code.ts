import { randomInt } from "node:crypto";

const ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const LINK_CODE_TTL_MS = 10 * 60 * 1000;
export const LINK_CODE_LENGTH = 8;

export function generateTelegramLinkCode(length: number = LINK_CODE_LENGTH): string {
  let out = "";
  for (let i = 0; i < length; i += 1) {
    out += ALPHABET[randomInt(ALPHABET.length)];
  }
  return out;
}

export function normalizeLinkCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[^0-9A-Z]/g, "");
}
