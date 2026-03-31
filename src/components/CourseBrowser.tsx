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

function formatDateTime(value: string | null): string {
  if (!value) return "k. A.";
  return new Date(value).toLocaleString("de-DE");
}

function formatRefreshStatus(status: string): string {
  switch (status) {
    case "success":
      return "erfolgreich";
    case "failed":
      return "fehlgeschlagen";
    case "running":
      return "läuft";
    default:
      return status;
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
    const parseDate = (iso: string) => new Date(`${iso}T00:00:00Z`);
    const MS_PER_DAY = 24 * 60 * 60 * 1000;
    const gaps: { from: string; to: string; gapDays: number }[] = [];

    for (let i = 1; i < plannedEntries.length; i += 1) {
      const prev = parseDate(plannedEntries[i - 1].startDate);
      const curr = parseDate(plannedEntries[i].startDate);
      const diffDays = Math.round((curr.getTime() - prev.getTime()) / MS_PER_DAY);
      if (diffDays > 1) {
        gaps.push({
          from: plannedEntries[i - 1].startDate,
          to: plannedEntries[i].startDate,
          gapDays: diffDays - 1
        });
      }
    }

    return gaps;
  }, [plannedEntries]);

  const handleAssignCourse = useCallback((courseId: number, startDate: string) => {
    setSelectedCoursesByDate((current) => ({
      ...current,
      [startDate]: courseId
    }));
  }, []);

  const handleRemoveCourse = useCallback((startDate: string) => {
    setSelectedCoursesByDate((current) => {
      const next = { ...current };
      delete next[startDate];
      return next;
    });
  }, []);

  const clearStudyPlan = useCallback(() => {
    setSelectedCoursesByDate({});
    setManualRefreshNotice("Studienplan wurde lokal zurückgesetzt.");
  }, []);

  const formattedPeriod = useMemo(() => {
    if (plannedEntries.length === 0) return null;
    const first = plannedEntries[0]?.startDate;
    const last = plannedEntries[plannedEntries.length - 1]?.startDate;
    if (!first || !last) return null;
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
            "Refresh nicht gestartet, weil bereits ein anderer Refresh läuft. Details unten im Statusbereich."
          );
        } else {
          setManualRefreshNotice(
            "Refresh fehlgeschlagen. Details findest du unten im Statusbereich."
          );
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setManualRefreshNotice(`Refresh fehlgeschlagen: ${message}`);
      } finally {
        router.refresh();
      }
    });
  }, [router]);

  const courseOptionsByStartDate = useMemo(() => {
    const map = new Map<string, CourseItem[]>();
    for (const course of initial.courses) {
      for (const startDate of course.startDates) {
        const current = map.get(startDate) ?? [];
        current.push(course);
        map.set(startDate, current);
      }
    }

    for (const [startDate, items] of map.entries()) {
      items.sort((a, b) => a.title.localeCompare(b.title, "de"));
      map.set(startDate, items);
    }

    return map;
  }, [initial.courses]);

  return (
    <>
      <section className="toolbar">
        <DateFilter
          options={initial.availableStartDates}
          value={selectedDate}
          onChange={handleDateChange}
          courseCount={filteredCourses.length}
          disabled={false}
        />
      </section>

      <section className="planner-layout">
        <CourseList
          courses={filteredCourses}
          activeDate={selectedDate}
          selectedByDate={selectedCoursesByDate}
          onAssignCourse={handleAssignCourse}
          onRemoveCourse={handleRemoveCourse}
        />

        <aside className="plan-panel" aria-live="polite">
          <div className="plan-panel-head">
            <p className="plan-panel-eyebrow">Mein Studienplan</p>
            <h2>Lokal im Browser</h2>
            <button
              type="button"
              className="manual-refresh-btn"
              onClick={handleManualRefresh}
              disabled={isRefreshingNow}
            >
              {isRefreshingNow ? "Refresh läuft..." : "Refresh jetzt starten"}
            </button>
            <button type="button" className="plan-clear-btn" onClick={clearStudyPlan}>
              Studienplan zurücksetzen
            </button>
            {manualRefreshNotice && <p className="manual-refresh-notice">{manualRefreshNotice}</p>}
          </div>

          {plannedEntries.length === 0 ? (
            <p className="plan-empty">
              Wähle in den Kurskarten einen Termin aus. Pro Startdatum ist genau ein Kurs in der
              Liste - bei gleicher Startzeit wird automatisch ersetzt.
            </p>
          ) : (
            <>
              <div className="plan-stats">
                <p>
                  <strong>{plannedEntries.length}</strong>{" "}
                  {plannedEntries.length === 1 ? "Kurs gewählt" : "Kurse gewählt"}
                </p>
                {formattedPeriod && (
                  <p>
                    Zeitraum:{" "}
                    <strong>
                      {formatDate(formattedPeriod.first)} - {formatDate(formattedPeriod.last)}
                    </strong>
                  </p>
                )}
                {gapHints.length > 0 ? (
                  <p className="plan-gap-hint">
                    Achtung: {gapHints.length} zeitliche{" "}
                    {gapHints.length === 1 ? "Lücke erkannt." : "Lücken erkannt."}
                  </p>
                ) : (
                  <p className="plan-gap-ok">Keine zeitlichen Lücken zwischen den Kursen.</p>
                )}
              </div>

              {gapHints.length > 0 && (
                <ul className="plan-gap-list">
                  {gapHints.map((gap) => (
                    <li key={`${gap.from}-${gap.to}`}>
                      {formatDate(gap.from)} bis {formatDate(gap.to)}: {gap.gapDays}{" "}
                      {gap.gapDays === 1 ? "Tag frei" : "Tage frei"}
                    </li>
                  ))}
                </ul>
              )}

              <ul className="plan-course-list">
                {plannedEntries.map((entry) => (
                  <li key={`${entry.startDate}-${entry.course.id}`} className="plan-course-item">
                    <div>
                      <p className="plan-course-date">{formatDate(entry.startDate)}</p>
                      <p className="plan-course-title">{entry.course.title}</p>
                      <label className="plan-swap-label" htmlFor={`swap-${entry.startDate}`}>
                        Kurs tauschen:
                      </label>
                      <select
                        id={`swap-${entry.startDate}`}
                        className="plan-swap-select"
                        value={entry.course.id}
                        onChange={(event) =>
                          handleAssignCourse(Number(event.target.value), entry.startDate)
                        }
                      >
                        {(courseOptionsByStartDate.get(entry.startDate) ?? []).map((option) => (
                          <option key={`${entry.startDate}-${option.id}`} value={option.id}>
                            {option.title}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      className="plan-remove-btn"
                      onClick={() => handleRemoveCourse(entry.startDate)}
                    >
                      Entfernen
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </aside>
      </section>
      <footer className="list-footer" aria-live="polite">
        {initial.latestRefresh && (
          <>
            <p className="footer-line">
              Letzter Refresh:{" "}
              {formatDateTime(
                initial.latestRefresh.finishedAt ?? initial.latestRefresh.startedAt
              )}{" "}
              | Status: {formatRefreshStatus(initial.latestRefresh.status)}
            </p>
            {initial.latestRefresh.status === "failed" && (
              <>
                {initial.latestRefresh.message && (
                      <details className="refresh-error-details" open>
                        <summary className="status-error">Refresh-Fehlerdetails anzeigen</summary>
                        <pre className="refresh-error-pre">{initial.latestRefresh.message}</pre>
                      </details>
                )}
                {initial.latestSuccessfulRefresh && (
                  <p className="footer-line">
                    Letzter erfolgreicher Refresh:{" "}
                    {formatDateTime(
                      initial.latestSuccessfulRefresh.finishedAt ??
                        initial.latestSuccessfulRefresh.startedAt
                    )}
                  </p>
                )}
              </>
            )}
          </>
        )}
        <p className="footer-line footer-legal">
          <Link href="/impressum" className="footer-impressum-link">
            Impressum &amp; Datenschutz
          </Link>
        </p>
      </footer>
    </>
  );
}

