import { db } from "@/lib/db";
import { scrapeCimdataCourses } from "@/lib/scraper/cimdata";

function dateFromIso(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00.000Z`);
}

function todayUtcMidnight(): Date {
  return dateFromIso(new Date().toISOString().slice(0, 10));
}

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
        `Gestartet: ${runningRefresh.startedAt.toLocaleString("de-DE")}`
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
          ? `Aktiver Lauf: ${firstRunningRefresh.id} (seit ${firstRunningRefresh.startedAt.toLocaleString("de-DE")})`
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
    const scrapedSlugs = new Set<string>();
    const now = new Date();
    const today = todayUtcMidnight();
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

      // Vergangene Termine bleiben als Historie erhalten. Nur zukünftige Termine
      // (ab heute), die nicht mehr im aktuellen Scrape stehen, werden entfernt –
      // so spiegeln Absagen/Verschiebungen sich wider, ohne die Vergangenheit zu verlieren.
      await db.courseStart.deleteMany({
        where: {
          courseId: upserted.id,
          startDate:
            scrapedDates.length > 0
              ? { gte: today, notIn: scrapedDates }
              : { gte: today }
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
      `Refresh fehlgeschlagen am ${new Date().toLocaleString("de-DE")}.`,
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
  // Nur aktive (nicht archivierte) Kurse anzeigen. Termine werden komplett
  // gezeigt – inkl. vergangener (Historie), damit der Verlauf sichtbar bleibt.
  const where = startDate
    ? {
        archivedAt: null,
        starts: {
          some: {
            startDate: dateFromIso(startDate)
          }
        }
      }
    : { archivedAt: null };

  const courses: Array<{
    id: number;
    slug: string;
    title: string;
    url: string;
    area: string | null;
    durationText: string | null;
    scheduleText: string | null;
    locationText: string | null;
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
    distinct: ["startDate"],
    orderBy: { startDate: "asc" },
    select: { startDate: true }
  });

  return {
    availableStartDates: dateRows.map((row) => row.startDate.toISOString().slice(0, 10)),
    courses: courses.map((course) => ({
      id: course.id,
      slug: course.slug,
      title: course.title,
      url: course.url,
      area: course.area,
      durationText: course.durationText,
      scheduleText: course.scheduleText,
      locationText: course.locationText,
      startDates: course.starts.map((item) => item.startDate.toISOString().slice(0, 10))
    }))
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
