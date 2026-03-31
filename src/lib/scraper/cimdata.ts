import {
  extractConcreteStartDates,
  type ParsedStartDate
} from "./normalize";

type ScrapedCourse = {
  slug: string;
  title: string;
  url: string;
  category: "Kurs";
  area: string | null;
  durationText: string | null;
  scheduleText: string | null;
  locationText: string | null;
  startDates: ParsedStartDate[];
};

type EducationCourseApiItem = {
  id: number;
  slug: string;
  isCoursePack: boolean;
  title: string;
  duration: number | null;
  startDates: string[];
  tags?: string[];
  locations?: unknown[];
};

type EducationCoursesApiResponse = {
  items: EducationCourseApiItem[];
  pageNumber: number;
  pageSize: number;
  totalPages: number;
  totalCount: number;
  hasNextPage: boolean;
};

function toIsoDate(value: string): string | null {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function courseUrlFromSlug(slug: string): string {
  const normalized = slug.startsWith("/") ? slug : `/${slug}`;
  return `https://www.cimdata.de/weiterbildung${normalized}`.replace(/\/{2,}/g, "/").replace("https:/", "https://");
}

async function fetchAllCourseItems(): Promise<EducationCourseApiItem[]> {
  const pageSize = 200;
  let pageNumber = 1;
  const all: EducationCourseApiItem[] = [];

  while (true) {
    const url = `https://api-gateway.cimdata.de/api/v1/education/courses/1?pageNumber=${pageNumber}&pageSize=${pageSize}&sortBy=1&package=false&ascending=true`;
    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          "accept": "application/json"
        }
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `CIMDATA API Netzwerkfehler auf Seite ${pageNumber} (${url}). Ursache: ${message}`
      );
    }

    if (!res.ok) {
      const bodySnippet = (await res.text()).slice(0, 1200);
      throw new Error(
        [
          `CIMDATA API Fehler: HTTP ${res.status} beim Abruf von Seite ${pageNumber}.`,
          `URL: ${url}`,
          bodySnippet ? `Antwortauszug: ${bodySnippet}` : "Antwortauszug: <leer>"
        ].join("\n")
      );
    }

    const json = (await res.json()) as EducationCoursesApiResponse;
    all.push(...(json.items ?? []));

    if (!json.hasNextPage || pageNumber >= json.totalPages) {
      break;
    }

    pageNumber += 1;
  }

  return all;
}

export async function scrapeCimdataCourses(): Promise<{
  courses: ScrapedCourse[];
  source: string;
}> {
  const items = await fetchAllCourseItems();

  const courses: ScrapedCourse[] = items
    .filter((item) => item && item.isCoursePack === false)
    .map((item) => {
      const startDates = (item.startDates ?? [])
        .map(toIsoDate)
        .filter((d): d is string => Boolean(d))
        .map((isoDate) => ({ isoDate, rawText: isoDate }));

      return {
        slug: item.slug.replaceAll("/", "").trim() || String(item.id),
        title: item.title,
        url: courseUrlFromSlug(item.slug),
        category: "Kurs" as const,
        area: item.tags?.length ? item.tags.join(", ") : null,
        durationText: typeof item.duration === "number" ? `${item.duration} Wochen` : null,
        scheduleText: null,
        locationText: null,
        startDates
      };
    })
    .filter((course) => course.title && course.slug && course.startDates.length > 0);

  return {
    courses,
    source:
      "https://api-gateway.cimdata.de/api/v1/education/courses/1?package=false (paginiert)"
  };
}
