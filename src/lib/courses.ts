import { db } from "@/lib/db";
import { scrapeCimdataCourses } from "@/lib/scraper/cimdata";

function dateFromIso(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

/** Heutiges Datum in Europe/Berlin als ISO-Tag (YYYY-MM-DD). */
export function todayIsoBerlin(now: Date = new Date()): string {
  // en-CA liefert das Format YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(now);
}

/** Prüft auf ein echtes Kalenderdatum im Format YYYY-MM-DD. */
export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = dateFromIso(value);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function formatBerlin(date: Date): string {
  return date.toLocaleString("de-DE", { timeZone: "Europe/Berlin" });
}

/** Ein Lauf, der länger als das hier „running“ ist, gilt als abgebrochen. */
const STALE_RUN_MS = 10 * 60 * 1000;

/**
 * Liefert der Abruf weniger als diesen Anteil der bisher aktiven Kurse, wird
 * nichts geschrieben (Schutz vor leeren oder halben Antworten der Quelle).
 */
const MIN_SCRAPE_SHARE = 0.5;

function formatRefreshError(error: unknown): string {
  if (error instanceof Error) {
    const details = [
      `Typ: ${error.name || "Error"}`,
      `Nachricht: ${error.message}`
    ];

    if (error.cause) {
      details.push(
        `Ursache: ${error.cause instanceof Error ? error.cause.message : String(error.cause)}`
      );
    }

    if (error.stack) {
      details.push(`Stack:\n${error.stack}`);
    }

    return details.join("\n\n");
  }

  return `Unbekannter Fehlertyp: ${String(error)}`;
}

export async function refreshCoursesFromSource() {
  // Hängende Läufe (z. B. von der Plattform nach maxDuration abgebrochen)
  // blockieren sonst jeden weiteren Refresh.
  await db.refreshRun.updateMany({
    where: {
      status: "running",
      startedAt: { lt: new Date(Date.now() - STALE_RUN_MS) }
    },
    data: {
      status: "failed",
      message: "Abgebrochen: Der Lauf wurde nicht innerhalb von 10 Minuten beendet.",
      finishedAt: new Date()
    }
  });

  const runningRefresh = await db.refreshRun.findFirst({
    where: { status: "running" },
    orderBy: [{ startedAt: "asc" }, { id: "asc" }]
  });

  if (runningRefresh) {
    return {
      success: false as const,
      reason: "already-running" as const,
      message: [
        "Doppel-Refresh verhindert: Es läuft bereits ein Refresh.",
        `Lauf-ID: ${runningRefresh.id}`,
        `Gestartet: ${formatBerlin(runningRefresh.startedAt)}`
      ].join("\n")
    };
  }

  const refreshRun = await db.refreshRun.create({
    data: {
      status: "running",
      source: "https://www.cimdata.de/weiterbildung/"
    }
  });

  try {
    const firstRunningRefresh = await db.refreshRun.findFirst({
      where: { status: "running" },
      orderBy: [{ startedAt: "asc" }, { id: "asc" }]
    });

    if (!firstRunningRefresh || firstRunningRefresh.id !== refreshRun.id) {
      const message = [
        "Doppel-Refresh verhindert: Ein anderer Lauf hat den Vorrang.",
        `Aktueller Lauf: ${refreshRun.id}`,
        firstRunningRefresh
          ? `Aktiver Lauf: ${firstRunningRefresh.id} (seit ${formatBerlin(firstRunningRefresh.startedAt)})`
          : "Aktiver Lauf konnte nicht eindeutig bestimmt werden."
      ].join("\n");

      await db.refreshRun.update({
        where: { id: refreshRun.id },
        data: {
          status: "failed",
          message,
          finishedAt: new Date()
        }
      });

      return {
        success: false as const,
        reason: "already-running" as const,
        message
      };
    }

    const { courses, source } = await scrapeCimdataCourses();

    const activeCourseCount = await db.course.count({
      where: { category: "Kurs", archivedAt: null }
    });
    if (
      courses.length === 0 ||
      courses.length < Math.floor(activeCourseCount * MIN_SCRAPE_SHARE)
    ) {
      throw new Error(
        `Unplausibler Abruf: ${courses.length} Kurse gefunden, bisher ${activeCourseCount} aktiv. ` +
          "Es wurde nichts geändert."
      );
    }

    const scrapedSlugs = new Set<string>();
    const now = new Date();
    const today = dateFromIso(todayIsoBerlin());
    let foundStarts = 0;

    for (const course of courses) {
      scrapedSlugs.add(course.slug);

      const upserted = await db.course.upsert({
        where: { slug: course.slug },
        create: {
          slug: course.slug,
          title: course.title,
          url: course.url,
          category: "Kurs",
          area: course.area,
          durationText: course.durationText,
          scheduleText: course.scheduleText,
          locationText: course.locationText,
          lastSeenAt: now,
          archivedAt: null
        },
        update: {
          title: course.title,
          url: course.url,
          category: "Kurs",
          area: course.area,
          durationText: course.durationText,
          scheduleText: course.scheduleText,
          locationText: course.locationText,
          lastSeenAt: now,
          // Falls der Kurs zuvor archiviert war und wieder auftaucht: reaktivieren.
          archivedAt: null
        }
      });

      const scrapedDates = course.startDates.map((item) => dateFromIso(item.isoDate));

      // Vergangene Termine bleiben als Historie erhalten. Nur künftige Termine
      // (nach heute, Europe/Berlin), die nicht mehr im aktuellen Scrape stehen,
      // werden entfernt: so spiegeln sich Absagen und Verschiebungen wider, ohne
      // die Vergangenheit zu verlieren. Der heutige Termin bleibt in jedem Fall.
      await db.courseStart.deleteMany({
        where: {
          courseId: upserted.id,
          startDate:
            scrapedDates.length > 0
              ? { gt: today, notIn: scrapedDates }
              : { gt: today }
        }
      });

      if (scrapedDates.length > 0) {
        // skipDuplicates verhindert Kollisionen mit bereits gespeicherten Terminen
        // (eindeutiger Index courseId + startDate).
        await db.courseStart.createMany({
          data: course.startDates.map((item) => ({
            courseId: upserted.id,
            startDate: dateFromIso(item.isoDate),
            rawText: item.rawText
          })),
          skipDuplicates: true
        });
      }

      foundStarts += course.startDates.length;
    }

    // Kurse, die nicht mehr gelistet sind, werden NICHT gelöscht, sondern
    // archiviert (Historie bleibt erhalten). Bereits Archivierte bleiben unberührt.
    await db.course.updateMany({
      where: {
        category: "Kurs",
        slug: { notIn: Array.from(scrapedSlugs) },
        archivedAt: null
      },
      data: { archivedAt: now }
    });

    await db.refreshRun.update({
      where: { id: refreshRun.id },
      data: {
        status: "success",
        source,
        foundCourses: courses.length,
        foundStarts,
        finishedAt: new Date()
      }
    });

    return {
      success: true as const,
      foundCourses: courses.length,
      foundStarts
    };
  } catch (error) {
    const message = [
      `Refresh fehlgeschlagen am ${formatBerlin(new Date())}.`,
      formatRefreshError(error),
      "Hinweis: Bitte prüfe Erreichbarkeit der CIMDATA API, gültige DB-Verbindung und Server-Logs."
    ].join("\n\n");

    await db.refreshRun.update({
      where: { id: refreshRun.id },
      data: {
        status: "failed",
        message,
        finishedAt: new Date()
      }
    });

    return {
      success: false as const,
      reason: "failed" as const,
      message
    };
  }
}

export async function getCoursesByStartDate(startDate?: string | null) {
  // Die Historie vergangener Termine bleibt in der Datenbank; angezeigt werden
  // Termine ab heute (Europe/Berlin). Vergangene Termine und archivierte Kurse
  // gehen getrennt mit, damit geteilte Pläne mit inzwischen vergangenen
  // Terminen oder eingestellten Kursen weiter aufgelöst werden. Die Kursliste
  // zeigt archivierte Kurse nicht an.
  const today = todayIsoBerlin();
  const todayDate = dateFromIso(today);

  const where = startDate
    ? { starts: { some: { startDate: dateFromIso(startDate) } } }
    : {};

  const courses: Array<{
    id: number;
    slug: string;
    title: string;
    url: string;
    area: string | null;
    durationText: string | null;
    scheduleText: string | null;
    locationText: string | null;
    archivedAt: Date | null;
    starts: Array<{ startDate: Date }>;
  }> = await db.course.findMany({
    where,
    include: {
      starts: {
        orderBy: { startDate: "asc" },
        select: { startDate: true }
      }
    },
    orderBy: [{ title: "asc" }]
  });

  const dateRows: Array<{ startDate: Date }> = await db.courseStart.findMany({
    where: {
      startDate: { gte: todayDate },
      course: { archivedAt: null }
    },
    distinct: ["startDate"],
    orderBy: { startDate: "asc" },
    select: { startDate: true }
  });

  const mapped = courses.map((course) => {
    const isoDates = course.starts.map((item) => item.startDate.toISOString().slice(0, 10));
    return {
      id: course.id,
      slug: course.slug,
      title: course.title,
      url: course.url,
      area: course.area,
      durationText: course.durationText,
      scheduleText: course.scheduleText,
      locationText: course.locationText,
      archived: course.archivedAt !== null,
      startDates: isoDates.filter((iso) => iso >= today),
      pastStartDates: isoDates.filter((iso) => iso < today)
    };
  });

  // Reihenfolge: aktive Kurse mit künftigen Terminen, aktive ohne, archivierte.
  const rank = (course: (typeof mapped)[number]) =>
    course.archived ? 2 : course.startDates.length > 0 ? 0 : 1;
  const sortedCourses = [...mapped].sort((a, b) => rank(a) - rank(b));

  return {
    today,
    availableStartDates: dateRows.map((row) => row.startDate.toISOString().slice(0, 10)),
    courses: sortedCourses
  };
}

/** Öffentliche Sicht auf einen Refresh-Lauf: ohne Fehlermeldung (enthält Stacktraces). */
export function toPublicRefreshRun(
  run: {
    status: string;
    foundCourses: number;
    foundStarts: number;
    startedAt: Date;
    finishedAt: Date | null;
  } | null
) {
  if (!run) return null;
  return {
    status: run.status,
    foundCourses: run.foundCourses,
    foundStarts: run.foundStarts,
    startedAt: run.startedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null
  };
}

export async function getLatestRefreshRun() {
  return db.refreshRun.findFirst({
    orderBy: { startedAt: "desc" }
  });
}

export async function getLatestSuccessfulRefreshRun() {
  return db.refreshRun.findFirst({
    where: { status: "success" },
    orderBy: { startedAt: "desc" }
  });
}
