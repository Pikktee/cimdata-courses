"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { triggerCourseRefresh } from "@/app/actions/refreshCourses";
import { CourseList } from "@/components/CourseList";
import { DateFilter } from "@/components/DateFilter";

type CourseItem = {
  id: number;
  slug: string;
  title: string;
  url: string;
  area: string | null;
  durationText: string | null;
  scheduleText: string | null;
  locationText: string | null;
  startDates: string[];
};

type LatestRefresh = {
  status: string;
  foundCourses: number;
  foundStarts: number;
  startedAt: string;
  finishedAt: string | null;
  message: string | null;
} | null;

type CoursesResponse = {
  availableStartDates: string[];
  courses: CourseItem[];
  latestRefresh: LatestRefresh;
  latestSuccessfulRefresh: LatestRefresh;
};

const STUDY_PLAN_STORAGE_KEY = "cimdata-study-plan-v1";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseIsoDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function parseDurationDays(durationText: string | null): number {
  if (!durationText) return 14;
  if (/\b4\b/.test(durationText)) return 28;
  return 14;
}

function formatDateTime(value: string | null): string {
  if (!value) return "k. A.";
  return new Date(value).toLocaleString("de-DE");
}

function formatRefreshStatus(status: string): string {
  switch (status) {
    case "success":
      return "Erfolgreich";
    case "failed":
      return "Fehlgeschlagen";
    case "running":
      return "Läuft";
    default:
      return status;
  }
}

function getRefreshStatusTone(status: string): "success" | "error" | "running" | "neutral" {
  switch (status) {
    case "success":
      return "success";
    case "failed":
      return "error";
    case "running":
      return "running";
    default:
      return "neutral";
  }
}

export function CourseBrowser({
  initial
}: {
  initial: CoursesResponse;
}) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState("all");
  const [selectedCoursesByDate, setSelectedCoursesByDate] = useState<Record<string, number>>({});
  const [hasLoadedLocalPlan, setHasLoadedLocalPlan] = useState(false);
  const [manualRefreshNotice, setManualRefreshNotice] = useState<string | null>(null);
  const [isRefreshingNow, startRefreshTransition] = useTransition();

  const handleDateChange = useCallback(
    (value: string) => {
      setSelectedDate(value);
    },
    []
  );

  const coursesById = useMemo(() => {
    return new Map(initial.courses.map((course) => [course.id, course]));
  }, [initial.courses]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STUDY_PLAN_STORAGE_KEY);
      if (!raw) {
        setHasLoadedLocalPlan(true);
        return;
      }

      const parsed = JSON.parse(raw) as {
        selectedCoursesByDate?: unknown;
      };

      if (parsed.selectedCoursesByDate && typeof parsed.selectedCoursesByDate === "object") {
        const nextEntries = Object.entries(parsed.selectedCoursesByDate).filter(
          ([startDate, courseId]) => typeof startDate === "string" && typeof courseId === "number"
        );
        setSelectedCoursesByDate(Object.fromEntries(nextEntries));
      }

    } catch {
      // Ignore unreadable local state and start clean.
    } finally {
      setHasLoadedLocalPlan(true);
    }
  }, []);

  useEffect(() => {
    if (!hasLoadedLocalPlan) return;
    window.localStorage.setItem(
      STUDY_PLAN_STORAGE_KEY,
      JSON.stringify({
        selectedCoursesByDate
      })
    );
  }, [hasLoadedLocalPlan, selectedCoursesByDate]);

  const filteredCourses = useMemo(() => {
    return initial.courses.filter(
      (course) => selectedDate === "all" || course.startDates.includes(selectedDate)
    );
  }, [initial.courses, selectedDate]);

  const plannedEntries = useMemo(() => {
    return Object.entries(selectedCoursesByDate)
      .map(([startDate, courseId]) => {
        const course = coursesById.get(courseId);
        if (!course) return null;
        return { startDate, course };
      })
      .filter((entry): entry is { startDate: string; course: CourseItem } => entry !== null)
      .sort((a, b) => a.startDate.localeCompare(b.startDate));
  }, [coursesById, selectedCoursesByDate]);

  const gapHints = useMemo(() => {
    const gaps: { from: string; to: string; gapDays: number }[] = [];

    for (let i = 1; i < plannedEntries.length; i += 1) {
      const previousEntry = plannedEntries[i - 1];
      const currentEntry = plannedEntries[i];
      const previousStart = parseIsoDate(previousEntry.startDate);
      const currentStart = parseIsoDate(currentEntry.startDate);
      const previousDurationDays = parseDurationDays(previousEntry.course.durationText);
      const gapDays = Math.round((currentStart.getTime() - previousStart.getTime()) / MS_PER_DAY) - previousDurationDays;

      if (gapDays > 0) {
        gaps.push({
          from: previousEntry.startDate,
          to: currentEntry.startDate,
          gapDays
        });
      }
    }

    return gaps;
  }, [plannedEntries]);

  const handleAssignCourse = useCallback(
    (courseId: number) => {
      if (selectedDate === "all") return;
      setSelectedCoursesByDate((current) => ({
        ...current,
        [selectedDate]: courseId
      }));
    },
    [selectedDate]
  );

  const handleRemoveCourse = useCallback((startDate: string) => {
    setSelectedCoursesByDate((current) => {
      const next = { ...current };
      delete next[startDate];
      return next;
    });
  }, []);

  const clearStudyPlan = useCallback(() => {
    setSelectedCoursesByDate({});
    setManualRefreshNotice("Studienplan wurde zurückgesetzt.");
  }, []);

  const formattedPeriod = useMemo(() => {
    if (plannedEntries.length === 0) return null;
    const first = plannedEntries[0]?.startDate;
    const lastEntry = plannedEntries[plannedEntries.length - 1];
    if (!first || !lastEntry) return null;
    const lastStart = parseIsoDate(lastEntry.startDate);
    const lastDurationDays = parseDurationDays(lastEntry.course.durationText);
    const lastEnd = new Date(lastStart.getTime() + lastDurationDays * MS_PER_DAY);
    const last = lastEnd.toISOString().slice(0, 10);
    return { first, last };
  }, [plannedEntries]);

  const formatDate = useCallback((isoDate: string) => {
    const [year, month, day] = isoDate.split("-");
    if (!year || !month || !day) return isoDate;
    return `${day}.${month}.${year}`;
  }, []);

  const handleManualRefresh = useCallback(() => {
    setManualRefreshNotice(null);
    startRefreshTransition(async () => {
      try {
        const result = await triggerCourseRefresh();
        if (result.ok) {
          setManualRefreshNotice(
            `Refresh erfolgreich: ${result.foundCourses ?? 0} Kurse, ${result.foundStarts ?? 0} Starttermine.`
          );
        } else if (result.reason === "already-running") {
          setManualRefreshNotice(
            "Ein Refresh läuft bereits."
          );
        } else {
          setManualRefreshNotice(
            "Refresh fehlgeschlagen. Details im Statusbereich."
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setManualRefreshNotice(`Fehler: ${message}`);
      } finally {
        router.refresh();
      }
    });
  }, [router]);

  const latestRefresh = initial.latestRefresh;
  const latestStatusTone = getRefreshStatusTone(latestRefresh?.status ?? "unknown");
  const latestStatusText = latestRefresh
    ? formatRefreshStatus(latestRefresh.status)
    : "Unbekannt";
  const refreshTimestampLabel =
    latestRefresh?.status === "running"
      ? "Läuft seit"
      : latestRefresh?.status === "failed"
        ? "Letzter Versuch"
        : "Zuletzt synchronisiert";
  const refreshTimestampValue =
    latestRefresh?.status === "running"
      ? formatDateTime(latestRefresh.startedAt)
      : latestRefresh?.status === "failed"
        ? formatDateTime(latestRefresh.finishedAt ?? latestRefresh.startedAt)
        : latestRefresh
          ? formatDateTime(latestRefresh.finishedAt ?? latestRefresh.startedAt)
          : "Noch kein Refresh";

  return (
    <>
      <section className="planner-layout">
        <aside className="planner-sidebar">
          <section className="toolbar">
            <DateFilter
              options={initial.availableStartDates}
              value={selectedDate}
              onChange={handleDateChange}
              disabled={false}
            />
          </section>

          <aside className="plan-panel" aria-live="polite">
            <div className="plan-panel-head">
              <p className="plan-panel-eyebrow">Studienplan</p>
              <h2>Deine Planung</h2>
            </div>

            {plannedEntries.length === 0 ? (
              <p className="plan-empty">
                Wähle ein Startdatum und füge Kurse aus dem Raster hinzu, um deinen Studienplan zu erstellen.
              </p>
            ) : (
              <>
                <div className="plan-stats">
                  <p className="plan-stats-count">
                    <strong>{plannedEntries.length}</strong> {plannedEntries.length === 1 ? "Kurs" : "Kurse"} geplant
                  </p>
                  {formattedPeriod && (
                    <p>
                      {formatDate(formattedPeriod.first)} — {formatDate(formattedPeriod.last)}
                    </p>
                  )}
                  {gapHints.length > 0 && (
                    <p className="plan-gap-hint">
                      {gapHints.length} {gapHints.length === 1 ? "Lücke" : "Lücken"} erkannt
                    </p>
                  )}
                </div>

                {gapHints.length > 0 && (
                  <ul className="plan-gap-list">
                    {gapHints.map((gap) => (
                      <li key={`${gap.from}-${gap.to}`}>
                        {formatDate(gap.from)} — {formatDate(gap.to)}: {gap.gapDays}{" "}
                        {gap.gapDays === 1 ? "Tag" : "Tage"} frei
                      </li>
                    ))}
                  </ul>
                )}

                <ul className="plan-course-list">
                  {plannedEntries.map((entry) => (
                    <li key={`${entry.startDate}-${entry.course.id}`} className="plan-course-item">
                      <div className="plan-course-item-head">
                        <p className="plan-course-date">{formatDate(entry.startDate)}</p>
                        <button
                          type="button"
                          className="plan-remove-icon-btn"
                          aria-label={`Kurs am ${formatDate(entry.startDate)} entfernen`}
                          title="Entfernen"
                          onClick={() => handleRemoveCourse(entry.startDate)}
                        >
                          <svg viewBox="0 0 24 24" aria-hidden>
                            <path
                              d="M18 6 6 18M6 6l12 12"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                            />
                          </svg>
                        </button>
                      </div>
                      <div>
                        <p className="plan-course-title">{entry.course.title}</p>
                        <p className="plan-course-duration">
                          Dauer: {entry.course.durationText ?? "k. A."}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>

                <button type="button" className="plan-clear-btn" onClick={clearStudyPlan}>
                  Plan zurücksetzen
                </button>
              </>
            )}
          </aside>
        </aside>

        <CourseList
          courses={filteredCourses}
          activeDate={selectedDate}
          selectedByDate={selectedCoursesByDate}
          onAssignCourse={handleAssignCourse}
          onRemoveCourse={handleRemoveCourse}
        />
      </section>

      <footer className="list-footer" aria-live="polite">
        <section className="refresh-summary-card" aria-label="Refresh-Status">
          <div className="refresh-summary-head">
            <div className="refresh-summary-title-wrap">
              <p className="refresh-summary-title">Synchronisation</p>
              <button
                type="button"
                className="manual-refresh-icon-btn"
                onClick={handleManualRefresh}
                disabled={isRefreshingNow}
                aria-label="Daten jetzt aktualisieren"
                title="Daten aktualisieren"
              >
                <svg viewBox="0 0 24 24" aria-hidden>
                  <path
                    d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </div>
            <span className={`refresh-status-badge refresh-status-badge-${latestStatusTone}`}>
              {latestStatusText}
            </span>
          </div>
          <p className="refresh-summary-time">
            <span className="refresh-summary-time-label">{refreshTimestampLabel}:</span>
            <strong>{refreshTimestampValue}</strong>
          </p>
          {manualRefreshNotice && <p className="manual-refresh-notice">{manualRefreshNotice}</p>}
          {latestRefresh?.status === "failed" && latestRefresh.message && (
            <details className="refresh-error-details">
              <summary className="status-error">
                Fehlerdetails
                <span className="refresh-error-time-inline">
                  {" "}
                  ({formatDateTime(latestRefresh.finishedAt ?? latestRefresh.startedAt)})
                </span>
              </summary>
              <pre className="refresh-error-pre">{latestRefresh.message}</pre>
            </details>
          )}
        </section>
        <p className="footer-line footer-legal">
          <Link href="/impressum" className="footer-impressum-link">
            Impressum &amp; Datenschutz
          </Link>
        </p>
      </footer>
    </>
  );
}
