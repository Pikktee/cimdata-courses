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
        <p className="eyebrow">CIMDATA KURSE</p>
        <h1>Starttermine</h1>
        <div className="hero-copy-track">
          <p className="hero-copy hero-copy-nowrap">
            Hier findest du alle verfügbaren{" "}
            <a
              className="hero-copy-link"
              href="https://www.cimdata.de/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Cimdata
            </a>
            -Kurse mit ihren konkreten Startterminen auf einen Blick.
          </p>
        </div>
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
