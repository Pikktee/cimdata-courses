import { CourseBrowser } from "@/components/CourseBrowser";
import {
  getCoursesByStartDate,
  getLatestRefreshRun,
  getLatestSuccessfulRefreshRun
} from "@/lib/courses";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const initialData = await getCoursesByStartDate(null);
  const [latestRefresh, latestSuccessfulRefresh] = await Promise.all([
    getLatestRefreshRun(),
    getLatestSuccessfulRefreshRun()
  ]);

  return (
    <main className="app-shell">
      <header className="hero">
        <div className="hero-topline">
          <p className="eyebrow">Weiterbildung planen</p>
          <div className="hero-badges" aria-label="Übersicht">
            <span>{initialData.courses.length} Kurse</span>
            <span>{initialData.availableStartDates.length} Termine</span>
          </div>
        </div>

        <h1>CIMDATA Studienplaner</h1>
        <p className="hero-copy">
          Finde passende Weiterbildungen, plane deinen Lernpfad mit konkreten
          Startterminen und behalte zeitliche Lücken im Blick.
        </p>
        <p className="hero-copy hero-copy-secondary">
          Quelle:{" "}
          <a
            className="hero-copy-link"
            href="https://www.cimdata.de/"
            target="_blank"
            rel="noopener noreferrer"
          >
            cimdata.de
          </a>
        </p>
      </header>
      <CourseBrowser
        initial={{
          ...initialData,
          latestRefresh: latestRefresh
            ? {
                status: latestRefresh.status,
                foundCourses: latestRefresh.foundCourses,
                foundStarts: latestRefresh.foundStarts,
                startedAt: latestRefresh.startedAt.toISOString(),
                finishedAt: latestRefresh.finishedAt?.toISOString() ?? null,
                message: latestRefresh.message ?? null
              }
            : null,
          latestSuccessfulRefresh: latestSuccessfulRefresh
            ? {
                status: latestSuccessfulRefresh.status,
                foundCourses: latestSuccessfulRefresh.foundCourses,
                foundStarts: latestSuccessfulRefresh.foundStarts,
                startedAt: latestSuccessfulRefresh.startedAt.toISOString(),
                finishedAt: latestSuccessfulRefresh.finishedAt?.toISOString() ?? null,
                message: latestSuccessfulRefresh.message ?? null
              }
            : null
        }}
      />
    </main>
  );
}
