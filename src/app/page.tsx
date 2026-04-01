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
          <p className="eyebrow">CIMDATA WEITERBILDUNG</p>
          <div className="hero-badges" aria-label="Übersicht">
            <span>{initialData.courses.length} Kurse</span>
            <span>{initialData.availableStartDates.length} Starttermine</span>
          </div>
        </div>

        <h1>Cimdata Studienplaner</h1>
        <p className="hero-copy">
          Plane deinen persönlichen Lernpfad mit konkreten Startterminen, tausche Kurse flexibel
          pro Termin aus und behalte Zeitraum sowie zeitliche Lücken jederzeit im Blick.
        </p>
        <p className="hero-copy hero-copy-secondary">
          Datenquelle:{" "}
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
