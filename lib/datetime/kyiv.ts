export const KYIV_TIME_ZONE = "Europe/Kyiv";

const kyivFormatter = new Intl.DateTimeFormat("en-GB", {
  timeZone: KYIV_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

type KyivParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
};

const readKyivParts = (date: Date): KyivParts => {
  const parts = kyivFormatter.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const hour = value("hour") === "24" ? 0 : Number(value("hour"));

  return {
    year: Number(value("year")),
    month: Number(value("month")),
    day: Number(value("day")),
    hour,
    minute: Number(value("minute")),
    second: Number(value("second")),
  };
};

const pad = (value: number) => String(value).padStart(2, "0");

export const formatKyivDateTime = (date: Date): string => {
  const parts = readKyivParts(date);
  return `${pad(parts.day)}.${pad(parts.month)}.${parts.year} ${pad(parts.hour)}:${pad(parts.minute)}`;
};

/** 09:00 (або інший годинник) у Europe/Kyiv → ISO UTC. */
export const kyivWallTimeToIso = (
  year: number,
  month: number,
  day: number,
  hours = 9,
  minutes = 0,
): string => {
  let utcMs = Date.UTC(year, month - 1, day, hours, minutes, 0);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const parts = readKyivParts(new Date(utcMs));
    const asUtc = Date.UTC(
      parts.year,
      parts.month - 1,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
    );
    const next = Date.UTC(year, month - 1, day, hours, minutes, 0) - (asUtc - utcMs);
    if (next === utcMs) break;
    utcMs = next;
  }

  return new Date(utcMs).toISOString();
};

export const kyivCalendarDate = (iso: string): Date | undefined => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  const { year, month, day } = readKyivParts(date);
  return new Date(year, month - 1, day);
};

export const getKyivDateTimeParts = (iso: string): KyivParts | undefined => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return undefined;
  return readKyivParts(date);
};
