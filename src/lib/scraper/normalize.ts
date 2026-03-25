export type ParsedStartDate = {
  isoDate: string;
  rawText: string;
};

const DATE_REGEX = /\b(\d{1,2})\.(\d{1,2})\.(\d{4})\b/g;

export function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

export function extractConcreteStartDates(text: string): ParsedStartDate[] {
  const matches = [...text.matchAll(DATE_REGEX)];
  const unique = new Map<string, ParsedStartDate>();

  for (const match of matches) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    const year = Number(match[3]);

    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      Number.isNaN(date.getTime()) ||
      date.getUTCFullYear() !== year ||
      date.getUTCMonth() !== month - 1 ||
      date.getUTCDate() !== day
    ) {
      continue;
    }

    const isoDate = date.toISOString().slice(0, 10);
    if (!unique.has(isoDate)) {
      unique.set(isoDate, {
        isoDate,
        rawText: `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`
      });
    }
  }

  return [...unique.values()].sort((a, b) => a.isoDate.localeCompare(b.isoDate));
}

export function splitPrimaryContent(text: string): string {
  const markers = [
    "Das könnte Sie auch interessieren",
    "Alle Weiterbildungen",
    "Mit diesen 5 Schritten zum neuen Traumjob"
  ];

  for (const marker of markers) {
    const index = text.indexOf(marker);
    if (index > 0) {
      return text.slice(0, index);
    }
  }

  return text;
}

export function inferCategoryFromText(text: string): "Kurs" | "Kurspaket" | "Unknown" {
  const lines = text
    .split("\n")
    .map((line) => normalizeWhitespace(line))
    .filter(Boolean)
    .slice(0, 80);

  const kursIndex = lines.findIndex((line) => line === "Kurs");
  const paketIndex = lines.findIndex((line) => line === "Kurspaket");

  if (kursIndex !== -1 && (paketIndex === -1 || kursIndex < paketIndex)) {
    return "Kurs";
  }

  if (paketIndex !== -1) {
    return "Kurspaket";
  }

  return "Unknown";
}
