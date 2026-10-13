import { CourseBrowser } from "@/components/CourseBrowser";
import { PlanShareButton } from "@/components/PlanShareButton";
import {
  getCoursesByStartDate,
  getLatestRefreshRun,
  getLatestSuccessfulRefreshRun,
  toPublicRefreshRun
} from "@/lib/courses";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [initialData, latestRefresh, latestSuccessfulRefresh] = await Promise.all([
    getCoursesByStartDate(null),
    getLatestRefreshRun(),
    getLatestSuccessfulRefreshRun()
  ]);

  return (
    <main className="app-shell">
      <header className="hero">
        <div className="hero-topline">
          <p className="eyebrow">Weiterbildung planen</p>
          <div className="hero-actions">
            <PlanShareButton />
          </div>
        </div>

        <h1>CIMDATA Studienplaner</h1>
        <p className="hero-copy">
          Finde passende Weiterbildungen, plane deinen Lernpfad mit konkreten
          Startterminen und behalte zeitliche Lücken im Blick.
        </p>
        <p className="hero-copy hero-copy-secondary">
          Unabhängiges Projekt, kein offizielles Angebot von CIMDATA. Kurse und
          Termine stammen von{" "}
          <a
            className="hero-copy-link"
            href="https://www.cimdata.de/"
            target="_blank"
            rel="noopener noreferrer"
          >
            cimdata.de
          </a>{" "}
          und werden täglich abgeglichen.
        </p>
      </header>
      <CourseBrowser
        initial={{
          ...initialData,
          latestRefresh: toPublicRefreshRun(latestRefresh),
          latestSuccessfulRefresh: toPublicRefreshRun(latestSuccessfulRefresh)
        }}
      />
    </main>
  );
}
