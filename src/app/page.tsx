import { CourseBrowser } from "@/components/CourseBrowser";
import { getCoursesByStartDate, getLatestRefreshRun } from "@/lib/courses";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const initialData = await getCoursesByStartDate(null);
  const latestRefresh = await getLatestRefreshRun();

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">CIMDATA KURSE</p>
        <h1>Starttermine</h1>
        <p className="hero-copy">
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
            : null
        }}
      />
    </main>
  );
}
