export type HourlyWageKind = "accounting" | "manual";

const KIND_LABEL: Record<HourlyWageKind, string> = {
  accounting: "облік",
  manual: "сума",
};

const DEFAULT_COMMENT: Record<HourlyWageKind, string> = {
  accounting: "погодинна",
  manual: "Вантажні роботи",
};

export const buildShiftHourlyWageDescription = (
  shiftId: number,
  kind: HourlyWageKind,
  comment: string
) =>
  `Зміна #${shiftId}, ${KIND_LABEL[kind]}, ${comment.trim() || DEFAULT_COMMENT[kind]}`;

const restAfterShiftPrefix = (description: string, shiftId: number) => {
  const text = (description ?? "").trim();
  const prefix = `Зміна #${shiftId}`;

  if (text.startsWith(`${prefix},`)) {
    return text.slice(prefix.length + 1).trim();
  }

  if (text.startsWith(prefix)) {
    return text.slice(prefix.length).replace(/^,\s*/, "").trim();
  }

  return text;
};

export const parseShiftHourlyWageDescription = (
  description: string,
  shiftId: number
): { kind: HourlyWageKind; comment: string } => {
  const rest = restAfterShiftPrefix(description, shiftId);

  if (rest.startsWith("облік,")) {
    return { kind: "accounting", comment: rest.slice("облік,".length).trim() };
  }

  if (rest.startsWith("сума,")) {
    return { kind: "manual", comment: rest.slice("сума,".length).trim() };
  }

  if (!rest || rest === "погодинна") {
    return { kind: "accounting", comment: rest || DEFAULT_COMMENT.accounting };
  }

  return { kind: "manual", comment: rest };
};

export const parseShiftHourlyWageComment = (
  description: string,
  shiftId: number
) => parseShiftHourlyWageDescription(description, shiftId).comment;

export const parseShiftHourlyWageKind = (
  description: string,
  shiftId: number
) => parseShiftHourlyWageDescription(description, shiftId).kind;

export const isHourlyWageDescriptionForShift = (
  description: string,
  shiftId: number
) => {
  const escapedId = String(shiftId).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`Зміна #${escapedId}(?:\\D|$)`).test(description ?? "");
};
