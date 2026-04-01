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
const PERMALINK_PLAN_PARAM = "plan";
const PERMALINK_MINIMIZED_PARAM = "min";
const PERMALINK_DATE_PARAM = "date";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseIsoDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

function parseDurationDays(durationText: string | null): number {
  if (!durationText) return 14;
  if (/\b4\b/.test(durationText)) return 28;
  return 14;
}

function normalizeCourseTitle(title: string): string {
  return title.trim().toLowerCase();
}

/** Gleicher Kurs (ID oder Titel) darf nur einmal im Plan vorkommen — Vergleich ohne aktuellen Termin-Slot. */
function isCourseAlreadyPlannedElsewhere(
  plan: Record<string, number>,
  coursesById: Map<number, CourseItem>,
  courseId: number,
  activeStartDate: string
): boolean {
  const course = coursesById.get(courseId);
  if (!course) return false;
  const titleNorm = normalizeCourseTitle(course.title);
  return Object.entries(plan).some(([startDate, id]) => {
    if (startDate === activeStartDate) return false;
    if (id === courseId) return true;
    const other = coursesById.get(id);
    if (!other) return false;
    return normalizeCourseTitle(other.title) === titleNorm;
  });
}

function formatDateTime(value: string | null): string {
  if (!value) return "k. A.";
  return new Date(value).toLocaleString("de-DE");
}

function encodePlanParam(plan: Record<string, number>): string {
  return Object.entries(plan)
    .filter(([startDate, courseId]) => typeof startDate === "string" && Number.isInteger(courseId))
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([startDate, courseId]) => `${startDate}:${courseId}`)
    .join(",");
}

function decodePlanParam(raw: string, coursesById: Map<number, CourseItem>): Record<string, number> {
  if (!raw) return {};
  const entries = raw
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [startDate, courseIdRaw] = part.split(":");
      const courseId = Number(courseIdRaw);
      if (!startDate || !Number.isInteger(courseId) || !coursesById.has(courseId)) return null;
      return [startDate, courseId] as const;
    })
    .filter((entry): entry is readonly [string, number] => entry !== null);
  return Object.fromEntries(entries);
}

function encodeMinimizedParam(ids: number[]): string {
  return ids.filter(Number.isInteger).join(",");
}

function decodeMinimizedParam(raw: string, coursesById: Map<number, CourseItem>): number[] {
  if (!raw) return [];
  return Array.from(
    new Set(
      raw
        .split(",")
        .map((part) => Number(part.trim()))
        .filter((id) => Number.isInteger(id) && coursesById.has(id))
    )
  );
}

export function CourseBrowser({
  initial
}: {
  initial: CoursesResponse;
}) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState("all");
  const [selectedCoursesByDate, setSelectedCoursesByDate] = useState<Record<string, number>>({});
  const [minimizedCourseIds, setMinimizedCourseIds] = useState<number[]>([]);
  const [hasLoadedLocalPlan, setHasLoadedLocalPlan] = useState(false);
  const [manualRefreshNotice, setManualRefreshNotice] = useState<string | null>(null);
  const [planActionNotice, setPlanActionNotice] = useState<string | null>(null);
  const [planEntryEffects, setPlanEntryEffects] = useState<
    Record<string, "add" | "replace" | "removing">
  >({});
  const [planPendingRemoval, setPlanPendingRemoval] = useState<Record<string, boolean>>({});
  const [isRefreshingNow, startRefreshTransition] = useTransition();

  const handleDateChange = useCallback((value: string) => {
    setSelectedDate(value);
    setPlanActionNotice(null);
  }, []);

  const coursesById = useMemo(() => {
    return new Map(initial.courses.map((course) => [course.id, course]));
  }, [initial.courses]);

  useEffect(() => {
    try {
      const searchParams = new URLSearchParams(window.location.search);
      const urlPlanRaw = searchParams.get(PERMALINK_PLAN_PARAM);
      const urlMinRaw = searchParams.get(PERMALINK_MINIMIZED_PARAM);
      const urlDate = searchParams.get(PERMALINK_DATE_PARAM);
      if (urlPlanRaw || urlMinRaw || urlDate) {
        setSelectedCoursesByDate(decodePlanParam(urlPlanRaw ?? "", coursesById));
        setMinimizedCourseIds(decodeMinimizedParam(urlMinRaw ?? "", coursesById));
        if (urlDate && (urlDate === "all" || /^\d{4}-\d{2}-\d{2}$/.test(urlDate))) {
          setSelectedDate(urlDate);
        }
        setHasLoadedLocalPlan(true);
        return;
      }

      const raw = window.localStorage.getItem(STUDY_PLAN_STORAGE_KEY);
      if (!raw) {
        setHasLoadedLocalPlan(true);
        return;
      }

      const parsed = JSON.parse(raw) as {
        selectedCoursesByDate?: unknown;
        minimizedCourseIds?: unknown;
      };

      if (parsed.selectedCoursesByDate && typeof parsed.selectedCoursesByDate === "object") {
        const nextEntries = Object.entries(parsed.selectedCoursesByDate).filter(
          ([startDate, courseId]) => typeof startDate === "string" && typeof courseId === "number"
        );
        setSelectedCoursesByDate(Object.fromEntries(nextEntries));
      }

      if (Array.isArray(parsed.minimizedCourseIds)) {
        const minimized = parsed.minimizedCourseIds.filter(
          (courseId): courseId is number =>
            typeof courseId === "number" && Number.isInteger(courseId) && coursesById.has(courseId)
        );
        setMinimizedCourseIds(Array.from(new Set(minimized)));
      }

    } catch {
      // Ignore unreadable local state and start clean.
    } finally {
      setHasLoadedLocalPlan(true);
    }
  }, [coursesById]);

  useEffect(() => {
    if (!hasLoadedLocalPlan) return;
    window.localStorage.setItem(
      STUDY_PLAN_STORAGE_KEY,
      JSON.stringify({
        selectedCoursesByDate,
        minimizedCourseIds
      })
    );
  }, [hasLoadedLocalPlan, minimizedCourseIds, selectedCoursesByDate]);

  useEffect(() => {
    if (!planActionNotice) return;
    const timer = window.setTimeout(() => setPlanActionNotice(null), 5000);
    return () => clearTimeout(timer);
  }, [planActionNotice]);

  useEffect(() => {
    if (!hasLoadedLocalPlan) return;
    const planParam = encodePlanParam(selectedCoursesByDate);
    const minimizedParam = encodeMinimizedParam(minimizedCourseIds);
    const url = new URL(window.location.href);
    if (planParam) {
      url.searchParams.set(PERMALINK_PLAN_PARAM, planParam);
    } else {
      url.searchParams.delete(PERMALINK_PLAN_PARAM);
    }
    if (minimizedParam) {
      url.searchParams.set(PERMALINK_MINIMIZED_PARAM, minimizedParam);
    } else {
      url.searchParams.delete(PERMALINK_MINIMIZED_PARAM);
    }
    if (selectedDate !== "all") {
      url.searchParams.set(PERMALINK_DATE_PARAM, selectedDate);
    } else {
      url.searchParams.delete(PERMALINK_DATE_PARAM);
    }
    window.history.replaceState({}, "", url.toString());
  }, [hasLoadedLocalPlan, minimizedCourseIds, selectedCoursesByDate, selectedDate]);

  const minimizedCourseIdSet = useMemo(() => new Set(minimizedCourseIds), [minimizedCourseIds]);

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

  const handleAssignCourse = useCallback(
    (courseId: number) => {
      if (selectedDate === "all") return;
      if (isCourseAlreadyPlannedElsewhere(selectedCoursesByDate, coursesById, courseId, selectedDate)) {
        const c = coursesById.get(courseId);
        setPlanActionNotice(
          c
            ? `„${c.title}“ ist bereits für einen anderen Termin im Studienplan.`
            : "Dieser Kurs ist bereits für einen anderen Termin im Studienplan."
        );
        return;
      }
      setPlanActionNotice(null);
      const previousCourseId = selectedCoursesByDate[selectedDate];
      const effectType =
        typeof previousCourseId === "number" && previousCourseId !== courseId ? "replace" : "add";
      setSelectedCoursesByDate((current) => ({
        ...current,
        [selectedDate]: courseId
      }));
      setPlanEntryEffects((current) => ({
        ...current,
        [selectedDate]: effectType
      }));
      window.setTimeout(() => {
        setPlanEntryEffects((current) => {
          if (!current[selectedDate] || current[selectedDate] !== effectType) return current;
          const next = { ...current };
          delete next[selectedDate];
          return next;
        });
      }, 650);
    },
    [selectedDate, selectedCoursesByDate, coursesById]
  );

  const isCourseBlockedDuplicate = useCallback(
    (courseId: number) => {
      if (selectedDate === "all") return false;
      return isCourseAlreadyPlannedElsewhere(selectedCoursesByDate, coursesById, courseId, selectedDate);
    },
    [selectedDate, selectedCoursesByDate, coursesById]
  );

  const handleRemoveCourse = useCallback((startDate: string) => {
    setSelectedCoursesByDate((current) => {
      const next = { ...current };
      delete next[startDate];
      return next;
    });
  }, []);

  const handleRemoveCourseWithConfirm = useCallback((startDate: string) => {
    if (planPendingRemoval[startDate]) return;
    const shouldRemove = window.confirm(
      "Möchtest du diesen Kurs wirklich aus dem Studienplan entfernen?"
    );
    if (!shouldRemove) return;
    setPlanPendingRemoval((current) => ({
      ...current,
      [startDate]: true
    }));
    setPlanEntryEffects((current) => ({
      ...current,
      [startDate]: "removing"
    }));
    window.setTimeout(() => {
      handleRemoveCourse(startDate);
      setPlanPendingRemoval((current) => {
        const next = { ...current };
        delete next[startDate];
        return next;
      });
      setPlanEntryEffects((current) => {
        const next = { ...current };
        delete next[startDate];
        return next;
      });
    }, 180);
  }, [handleRemoveCourse, planPendingRemoval]);

  const toggleCourseMinimized = useCallback((courseId: number) => {
    setMinimizedCourseIds((current) => {
      if (current.includes(courseId)) {
        return current.filter((id) => id !== courseId);
      }
      return [courseId, ...current];
    });
  }, []);

  const clearStudyPlan = useCallback(() => {
    const shouldClear = window.confirm(
      "Möchtest du den Studienplan wirklich komplett zurücksetzen? Diese Aktion kann nicht rückgängig gemacht werden."
    );
    if (!shouldClear) return;
    setSelectedCoursesByDate({});
    setPlanEntryEffects({});
    setPlanPendingRemoval({});
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

  /** Freie Kalendertage zwischen Kursende (exkl.) und nächstem Kursstart (exkl.), mind. 14 Tage. */
  const planGapRanges = useMemo(() => {
    const ranges: { from: string; to: string }[] = [];
    for (let i = 1; i < plannedEntries.length; i += 1) {
      const previousEntry = plannedEntries[i - 1];
      const currentEntry = plannedEntries[i];
      const previousStart = parseIsoDate(previousEntry.startDate);
      const currentStart = parseIsoDate(currentEntry.startDate);
      const previousDurationDays = parseDurationDays(previousEntry.course.durationText);
      const previousEndExclusive = new Date(
        previousStart.getTime() + previousDurationDays * MS_PER_DAY
      );
      const gapFreeDays = Math.round((currentStart.getTime() - previousEndExclusive.getTime()) / MS_PER_DAY);
      if (gapFreeDays < 14) continue;
      const from = previousEndExclusive.toISOString().slice(0, 10);
      const lastFree = new Date(currentStart.getTime() - MS_PER_DAY);
      const to = lastFree.toISOString().slice(0, 10);
      ranges.push({ from, to });
    }
    return ranges;
  }, [plannedEntries]);

  const gapCount = planGapRanges.length;

  const gapTooltipText = useMemo(() => {
    if (planGapRanges.length === 0) return "";
    const lines = planGapRanges.map((g) => `• ${formatDate(g.from)} – ${formatDate(g.to)}`);
    return `Zeiträume mit mindestens 14 freien Tagen zwischen zwei Kursen:\n${lines.join("\n")}`;
  }, [planGapRanges, formatDate]);

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
  const refreshFailed = latestRefresh?.status === "failed";
  const syncErrorTooltip = refreshFailed
    ? (latestRefresh?.message?.trim()
        ? latestRefresh.message.replace(/\r?\n+/g, " ").trim().slice(0, 1200)
        : "Synchronisation fehlgeschlagen.")
    : "";
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
              className="control-card--sidebar"
            />
          </section>

          <aside className="plan-panel control-card control-card--sidebar" aria-live="polite">
            <div className="control-head">
              <span className="control-label">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden
                  style={{
                    display: "inline",
                    verticalAlign: "-0.12em",
                    marginRight: "0.35rem",
                    opacity: 0.5
                  }}
                >
                  <path d="M9 6h11M9 12h11M9 18h7" />
                  <circle cx="5" cy="6" r="1.25" fill="currentColor" stroke="none" />
                  <circle cx="5" cy="12" r="1.25" fill="currentColor" stroke="none" />
                  <circle cx="5" cy="18" r="1.25" fill="currentColor" stroke="none" />
                </svg>
                Studienplan
              </span>
            </div>

            {planActionNotice && (
              <p className="plan-action-notice" role="status">
                {planActionNotice}
              </p>
            )}

            <div className="plan-panel-body">
            {plannedEntries.length === 0 ? (
              <p className="plan-empty">
                Wähle ein Startdatum und füge Kurse aus dem Raster hinzu, um deinen Studienplan zu erstellen.
              </p>
            ) : (
              <>
                <div className="plan-stats">
                  <p className="plan-stats-primary">
                    <strong>{plannedEntries.length}</strong>{" "}
                    {plannedEntries.length === 1 ? "Kurs" : "Kurse"}
                    {formattedPeriod && (
                      <>
                        <span className="plan-stats-sep" aria-hidden>
                          {" "}
                          ·{" "}
                        </span>
                        {formatDate(formattedPeriod.first)} — {formatDate(formattedPeriod.last)}
                      </>
                    )}
                  </p>
                  {gapCount > 0 && (
                    <p className="plan-gap-hint">
                      <span
                        className="plan-gap-hint-inner has-tooltip"
                        data-tooltip={gapTooltipText}
                        aria-label={gapTooltipText}
                      >
                        <svg className="plan-gap-hint-icon" viewBox="0 0 24 24" aria-hidden>
                          <path
                            d="M12 9v4M12 17h.01"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                          />
                          <path
                            d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                        <span>
                          {gapCount}&nbsp;{gapCount === 1 ? "Lücke" : "Lücken"}
                        </span>
                      </span>
                    </p>
                  )}
                </div>

                <ul className="plan-course-list">
                  {plannedEntries.map((entry) => (
                    <li
                      key={`${entry.startDate}-${entry.course.id}`}
                      className={`plan-course-item${
                        planEntryEffects[entry.startDate]
                          ? ` plan-course-item-${planEntryEffects[entry.startDate]}`
                          : ""
                      }`}
                    >
                      <div className="plan-course-item-head">
                        <button
                          type="button"
                          className="plan-course-date-link"
                          onClick={() => handleDateChange(entry.startDate)}
                          aria-label={`Startdatum ${formatDate(entry.startDate)} im Filter auswählen`}
                          title={`Startdatum ${formatDate(entry.startDate)} auswählen`}
                        >
                          {formatDate(entry.startDate)}
                        </button>
                        <button
                          type="button"
                          className="plan-remove-icon-btn"
                          aria-label={`Kurs am ${formatDate(entry.startDate)} entfernen`}
                          title="Entfernen"
                          disabled={Boolean(planPendingRemoval[entry.startDate])}
                          onClick={() => handleRemoveCourseWithConfirm(entry.startDate)}
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
              </>
            )}
            </div>

            {plannedEntries.length > 0 && (
              <button type="button" className="plan-clear-btn" onClick={clearStudyPlan}>
                Plan zurücksetzen
              </button>
            )}
          </aside>
        </aside>

        <CourseList
          courses={filteredCourses}
          activeDate={selectedDate}
          selectedByDate={selectedCoursesByDate}
          onAssignCourse={handleAssignCourse}
          onRemoveCourse={handleRemoveCourse}
          isCourseBlocked={isCourseBlockedDuplicate}
          isMinimized={(courseId) => minimizedCourseIdSet.has(courseId)}
          onToggleMinimized={toggleCourseMinimized}
        />
      </section>

      <footer className="list-footer" aria-live="polite">
        <div className="footer-bar">
          <p className="footer-bar-impressum">
            <Link href="/impressum" className="footer-impressum-link">
              Impressum &amp; Datenschutz
            </Link>
          </p>
          <div className="footer-bar-sync">
            <span className="footer-sync-meta">
              <span className="footer-sync-label">{refreshTimestampLabel}:</span>{" "}
              {latestRefresh ? (
                <time
                  className="footer-sync-time"
                  dateTime={
                    latestRefresh.status === "running"
                      ? latestRefresh.startedAt
                      : (latestRefresh.finishedAt ?? latestRefresh.startedAt)
                  }
                >
                  {refreshTimestampValue}
                </time>
              ) : (
                <span className="footer-sync-time">{refreshTimestampValue}</span>
              )}
            </span>
            <span
              className={
                refreshFailed
                  ? "footer-sync-btn-wrap has-tooltip-footer-sync-error"
                  : "footer-sync-btn-wrap"
              }
              data-tooltip={refreshFailed ? syncErrorTooltip : undefined}
            >
              <button
                type="button"
                className={`manual-refresh-icon-btn manual-refresh-icon-btn--footer${
                  refreshFailed ? " manual-refresh-icon-btn--error" : ""
                }`}
                onClick={handleManualRefresh}
                disabled={isRefreshingNow}
                aria-label={
                  refreshFailed && syncErrorTooltip
                    ? `Daten aktualisieren. Letzter Fehler: ${syncErrorTooltip.slice(0, 280)}`
                    : "Daten jetzt aktualisieren"
                }
                title={
                  refreshFailed && syncErrorTooltip
                    ? syncErrorTooltip
                    : "Daten aktualisieren"
                }
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
            </span>
          </div>
        </div>
        {manualRefreshNotice ? (
          <p className="footer-manual-notice" role="status">
            {manualRefreshNotice}
          </p>
        ) : null}
      </footer>
    </>
  );
}
