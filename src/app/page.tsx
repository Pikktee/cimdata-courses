import { CourseBrowser } from "@/components/CourseBrowser";
import { getCoursesByStartDate, getLatestRefreshRun } from "@/lib/courses";

export default async function HomePage() {
  const initialData = await getCoursesByStartDate(null);
  const latestRefresh = await getLatestRefreshRun();

  return (
    <main className="app-shell">
      <header className="hero">
        <p className="eyebrow">CIMDATA Kurs-Scraper</p>
        <h1>Kurse nach konkretem Startdatum filtern</h1>
        <p className="hero-copy">
          Diese Ansicht zeigt ausschließlich Kurse (keine Kurspakete) und erlaubt die Filterung
          nach exakten Startterminen.
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
