import {
  extractConcreteStartDates,
  type ParsedStartDate
} from "./normalize";
import { request as httpsRequest } from "node:https";
import { rootCertificates } from "node:tls";

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

const SECTIGO_OV_R36_PEM = `-----BEGIN CERTIFICATE-----
MIIGTDCCBDSgAwIBAgIQLBo8dulD3d3/GRsxiQrtcTANBgkqhkiG9w0BAQwFADBf
MQswCQYDVQQGEwJHQjEYMBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTYwNAYDVQQD
Ey1TZWN0aWdvIFB1YmxpYyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gUm9vdCBSNDYw
HhcNMjEwMzIyMDAwMDAwWhcNMzYwMzIxMjM1OTU5WjBgMQswCQYDVQQGEwJHQjEY
MBYGA1UEChMPU2VjdGlnbyBMaW1pdGVkMTcwNQYDVQQDEy5TZWN0aWdvIFB1Ymxp
YyBTZXJ2ZXIgQXV0aGVudGljYXRpb24gQ0EgT1YgUjM2MIIBojANBgkqhkiG9w0B
AQEFAAOCAY8AMIIBigKCAYEApkMtJ3R06jo0fceI0M52B7K+TyMeGcv2BQ5AVc3j
lYt76TvHIu/nNe22W/RJXX9rWUD/2GE6GF5x0V4bsY7K3IeJ8E7+KzG/TGboySfD
u+F52jqQBbY62ofhYjMeiAbLI02+FqwHeM8uIrUtcX8b2RCxF358TB0NHVccAXZc
FYgZndZCeXxjuca7pJJ20LLUnXtgXcjAE1vY4WvbReW0W6mkeZyNGdmpTcFs5Y+s
yy6LtE5Zocji9J9NlNnReox2RWVyEXpA1ChZ4gqN+ZpVSIQ0HBorVFbBKyhdZyEX
gZgNSNtBRwxqwIzJePJhYd4ZUhO1vk+/uP3nwDk0p95q/j7naXNCSvESnrHPypaB
WRK066nKfPRPi9m9kIOhMdYfS8giFRTcdgL24Ycilj7ecAK9Trh0VbjwouJ4WH+x
bt47u68ZFCD/ac55I0DNHkCpaPruj6e9Rmr7K46wZDAYXuEAqB7tGG/jd6JAA+H2
O44CV98NRsU213f1kScIZntNAgMBAAGjggGBMIIBfTAfBgNVHSMEGDAWgBRWc1hk
lfmSGrASKgRieaFAFYghSTAdBgNVHQ4EFgQU42Z0u3BojSxdTg6mSo+bNyKcgpIw
DgYDVR0PAQH/BAQDAgGGMBIGA1UdEwEB/wQIMAYBAf8CAQAwHQYDVR0lBBYwFAYI
KwYBBQUHAwEGCCsGAQUFBwMCMBsGA1UdIAQUMBIwBgYEVR0gADAIBgZngQwBAgIw
VAYDVR0fBE0wSzBJoEegRYZDaHR0cDovL2NybC5zZWN0aWdvLmNvbS9TZWN0aWdv
UHVibGljU2VydmVyQXV0aGVudGljYXRpb25Sb290UjQ2LmNybDCBhAYIKwYBBQUH
AQEEeDB2ME8GCCsGAQUFBzAChkNodHRwOi8vY3J0LnNlY3RpZ28uY29tL1NlY3Rp
Z29QdWJsaWNTZXJ2ZXJBdXRoZW50aWNhdGlvblJvb3RSNDYucDdjMCMGCCsGAQUF
BzABhhdodHRwOi8vb2NzcC5zZWN0aWdvLmNvbTANBgkqhkiG9w0BAQwFAAOCAgEA
BZXWDHWC3cubb/e1I1kzi8lPFiK/ZUoH09ufmVOrc5ObYH/XKkWUexSPqRkwKFKr
7r8OuG+p7VNB8rifX6uopqKAgsvZtZsq7iAFw04To6vNcxeBt1Eush3cQ4b8nbQR
MQLChgEAqwhuXp9P48T4QEBSksYav7+aFjNySsLYlPzNqVM3RNwvBdvp6vgDtGwc
xlKQZVuuNVIaoYyls8swhxDeSHKpRdxRauTLZ+pl+wGvy0pnrLEJGSz9mOEmfbod
e/XopR2NGqaHJ6bIjyxPu6UtyQGI26En7UAEozACrHz06Nx2jTAY9E6NeB6XuobE
wLK025ZRmvglcURG1BrV24tGHHTgxCe8M3oGlpUSMTKQ2dkgljZVYt+gKdFtWELZ
MuRdi+X3XsrR8LFz+aLUiDRfQqhmw3RxjIyVKvvu9UPYY1nsvxYmFnUSeM+2q1z/
iPUry+xDY9MC6+IhleKT094VKdFVp7LXH42+wvU+17lRolQ2mK2N/nBLVBwaIhib
QXw4VYKwB86Bc6eS6iqsc94KEgD/U4VsjmgfhK+Xp4NM+VYzTTa3QeV3p8xOM0cw
q1p8oZFA+OBcz3FYWpDIe5j0NWKlw9hXsTyPY/HeZUV59akskSOSRSmDfe8wJDPX
58uB9/7lud0G3x0pxQAcffP0ayKavNwDTw4UfJ34cEw=
-----END CERTIFICATE-----`;

function isLikelyTlsChainError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const maybeCause = (error as { cause?: unknown }).cause;
  if (!maybeCause || typeof maybeCause !== "object") return false;
  const code = (maybeCause as { code?: string }).code;
  return code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" || code === "UNABLE_TO_GET_ISSUER_CERT";
}

async function fetchCoursesPageWithCustomCa(
  url: string,
  pageNumber: number
): Promise<EducationCoursesApiResponse> {
  return new Promise((resolve, reject) => {
    const req = httpsRequest(
      url,
      {
        method: "GET",
        headers: {
          accept: "application/json"
        },
        // Keep platform/system root CAs and append missing intermediate chain.
        ca: [...rootCertificates, SECTIGO_OV_R36_PEM].join("\n")
      },
      (res) => {
        const chunks: string[] = [];
        res.setEncoding("utf8");
        res.on("data", (chunk) => {
          chunks.push(chunk);
        });
        res.on("end", () => {
          const body = chunks.join("");
          const status = res.statusCode ?? 0;

          if (status < 200 || status >= 300) {
            const bodySnippet = body.slice(0, 1200);
            reject(
              new Error(
                [
                  `CIMDATA API Fehler: HTTP ${status} beim Abruf von Seite ${pageNumber} (TLS-Fallback).`,
                  `URL: ${url}`,
                  bodySnippet ? `Antwortauszug: ${bodySnippet}` : "Antwortauszug: <leer>"
                ].join("\n")
              )
            );
            return;
          }

          try {
            resolve(JSON.parse(body) as EducationCoursesApiResponse);
          } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            reject(
              new Error(
                `CIMDATA API Fehler: Ungültiges JSON im TLS-Fallback auf Seite ${pageNumber}. Ursache: ${message}`
              )
            );
          }
        });
      }
    );

    req.on("error", (error) => {
      const message = error instanceof Error ? error.message : String(error);
      reject(
        new Error(
          `CIMDATA API Netzwerkfehler im TLS-Fallback auf Seite ${pageNumber} (${url}). Ursache: ${message}`
        )
      );
    });
    req.end();
  });
}

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
    let json: EducationCoursesApiResponse;

    try {
      const res = await fetch(url, {
        headers: {
          "accept": "application/json"
        }
      });

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

      json = (await res.json()) as EducationCoursesApiResponse;
    } catch (error) {
      if (isLikelyTlsChainError(error)) {
        json = await fetchCoursesPageWithCustomCa(url, pageNumber);
      } else if (error instanceof Error && error.message.startsWith("CIMDATA API Fehler: HTTP")) {
        throw error;
      } else {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `CIMDATA API Netzwerkfehler auf Seite ${pageNumber} (${url}). Ursache: ${message}`
        );
      }
    }

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
