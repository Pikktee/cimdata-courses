"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  useTransition
} from "react";
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
  // Konservativer Default: unbekannte Dauer als 4 Wochen behandeln,
  // damit Überlappungen nicht versehentlich erlaubt werden.
  if (!durationText) return 28;
  const text = durationText.toLowerCase();
  const unitMatches = Array.from(
    text.matchAll(/(\d+(?:[.,]\d+)?)\s*(tag|tage|woche|wochen|monat|monate)\b/g)
  )
    .map((match) => {
      const value = Number(match[1].replace(",", "."));
      const unit = match[2];
      if (!Number.isFinite(value) || value <= 0) return null;
      if (unit.startsWith("tag")) return value;
      if (unit.startsWith("woche")) return value * 7;
      if (unit.startsWith("monat")) return value * 28;
      return null;
    })
    .filter((value): value is number => value !== null);

  if (unitMatches.length > 0) {
    return Math.round(Math.max(...unitMatches));
  }

  const numberMatches = Array.from(text.matchAll(/(\d+(?:[.,]\d+)?)/g))
    .map((match) => Number(match[1].replace(",", ".")))
    .filter((value) => Number.isFinite(value) && value > 0);
  if (numberMatches.length === 0) return 28;

  // Fallback ohne Einheit: numerischen Wert als Wochen interpretieren.
  return Math.round(Math.max(...numberMatches) * 7);
}

function normalizeCourseTitle(title: string): string {
  return title.trim().toLowerCase();
}

/** Andere Plan-Slots mit gleicher Kurs-ID oder gleichem Titel (ohne aktuellen Termin-Slot). */
function findDuplicatePlanSlotsElsewhere(
  plan: Record<string, number>,
  coursesById: Map<number, CourseItem>,
  courseId: number,
  activeStartDate: string
): string[] {
  const course = coursesById.get(courseId);
  if (!course) return [];
  const titleNorm = normalizeCourseTitle(course.title);
  return Object.entries(plan)
    .filter(([startDate, id]) => {
      if (startDate === activeStartDate) return false;
      if (id === courseId) return true;
      const other = coursesById.get(id);
      if (!other) return false;
      return normalizeCourseTitle(other.title) === titleNorm;
    })
    .map(([startDate]) => startDate);
}

/** Erster bekannter Kurs-Starttermin im Lückenbereich [from, to], sonst null. */
function firstAvailableStartInGap(
  fromIso: string,
  toIso: string,
  availableStartDates: string[]
): string | null {
  const hit = availableStartDates.find((d) => d >= fromIso && d <= toIso);
  return hit ?? null;
}

function getOverlappingPlannedEntry(
  plan: Record<string, number>,
  coursesById: Map<number, CourseItem>,
  candidateCourseId: number,
  selectedStartDate: string
): { startDate: string; title: string } | null {
  const candidateCourse = coursesById.get(candidateCourseId);
  if (!candidateCourse) return null;

  const candidateStart = parseIsoDate(selectedStartDate);
  const candidateEndExclusive = new Date(
    candidateStart.getTime() + parseDurationDays(candidateCourse.durationText) * MS_PER_DAY
  );

  for (const [startDate, plannedCourseId] of Object.entries(plan)) {
    // Der aktuell ausgewählte Slot wird ersetzt und darf daher nicht als Konflikt zählen.
    if (startDate === selectedStartDate) continue;
    const plannedCourse = coursesById.get(plannedCourseId);
    if (!plannedCourse) continue;

    const plannedStart = parseIsoDate(startDate);
    const plannedEndExclusive = new Date(
      plannedStart.getTime() + parseDurationDays(plannedCourse.durationText) * MS_PER_DAY
    );

    const overlaps = candidateStart < plannedEndExclusive && plannedStart < candidateEndExclusive;
    if (overlaps) {
      return { startDate, title: plannedCourse.title };
    }
  }

  return null;
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
    Record<string, "add" | "replace">
  >({});
  const [planConfirmDialog, setPlanConfirmDialog] = useState<
    | null
    | { kind: "clear"; courseCount: number }
    | {
        kind: "moveDuplicate";
        courseId: number;
        newStartDate: string;
        removeStartDates: string[];
      }
  >(null);
  const [isRefreshingNow, startRefreshTransition] = useTransition();
  const [scrollToCourseRequest, setScrollToCourseRequest] = useState<{
    courseId: number;
    requestId: number;
  } | null>(null);
  const planConfirmTitleId = useId();
  const planConfirmCancelRef = useRef<HTMLButtonElement>(null);

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

  const formatDate = useCallback((isoDate: string) => {
    const [year, month, day] = isoDate.split("-");
    if (!year || !month || !day) return isoDate;
    return `${day}.${month}.${year}`;
  }, []);

  const performAssignToSelectedDate = useCallback(
    (courseId: number, slotDate: string) => {
      const previousCourseId = selectedCoursesByDate[slotDate];
      const effectType =
        typeof previousCourseId === "number" && previousCourseId !== courseId ? "replace" : "add";
      setSelectedCoursesByDate((current) => ({
        ...current,
        [slotDate]: courseId
      }));
      setPlanEntryEffects((current) => ({
        ...current,
        [slotDate]: effectType
      }));
      window.setTimeout(() => {
        setPlanEntryEffects((current) => {
          if (!current[slotDate] || current[slotDate] !== effectType) return current;
          const next = { ...current };
          delete next[slotDate];
          return next;
        });
      }, 650);
    },
    [selectedCoursesByDate]
  );

  const handleAssignCourse = useCallback(
    (courseId: number) => {
      if (selectedDate === "all") return;
      const overlappingEntry = getOverlappingPlannedEntry(
        selectedCoursesByDate,
        coursesById,
        courseId,
        selectedDate
      );
      if (overlappingEntry) {
        const candidate = coursesById.get(courseId);
        setPlanActionNotice(
          candidate
            ? `„${candidate.title}“ überlappt mit „${overlappingEntry.title}“ (${formatDate(overlappingEntry.startDate)}).`
            : `Der Kurs überlappt mit einem bereits geplanten Kurs (${formatDate(overlappingEntry.startDate)}).`
        );
        return;
      }
      const duplicateSlots = findDuplicatePlanSlotsElsewhere(
        selectedCoursesByDate,
        coursesById,
        courseId,
        selectedDate
      );
      if (duplicateSlots.length > 0) {
        setPlanActionNotice(null);
        setPlanConfirmDialog({
          kind: "moveDuplicate",
          courseId,
          newStartDate: selectedDate,
          removeStartDates: duplicateSlots
        });
        return;
      }
      setPlanActionNotice(null);
      performAssignToSelectedDate(courseId, selectedDate);
    },
    [
      selectedDate,
      selectedCoursesByDate,
      coursesById,
      formatDate,
      performAssignToSelectedDate
    ]
  );

  const isPlannedElsewhere = useCallback(
    (courseId: number) => {
      if (selectedDate === "all") return false;
      return (
        findDuplicatePlanSlotsElsewhere(
          selectedCoursesByDate,
          coursesById,
          courseId,
          selectedDate
        ).length > 0
      );
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

  const toggleCourseMinimized = useCallback((courseId: number) => {
    setMinimizedCourseIds((current) => {
      if (current.includes(courseId)) {
        return current.filter((id) => id !== courseId);
      }
      return [courseId, ...current];
    });
  }, []);

  const ensureCourseVisibleInList = useCallback((courseId: number) => {
    setMinimizedCourseIds((current) =>
      current.includes(courseId) ? current.filter((id) => id !== courseId) : current
    );
  }, []);

  const clearScrollToCourseRequest = useCallback(() => {
    setScrollToCourseRequest(null);
  }, []);

  const handleJumpToCourseFromPlan = useCallback(
    (startDate: string, courseId: number) => {
      handleDateChange(startDate);
      ensureCourseVisibleInList(courseId);
      setScrollToCourseRequest({ courseId, requestId: Date.now() });
    },
    [handleDateChange, ensureCourseVisibleInList]
  );

  const performClearStudyPlan = useCallback(() => {
    setSelectedCoursesByDate({});
    setPlanEntryEffects({});
    setManualRefreshNotice("Studienplan wurde zurückgesetzt.");
    setPlanConfirmDialog(null);
  }, []);

  const openClearStudyPlanDialog = useCallback(() => {
    const courseCount = Object.keys(selectedCoursesByDate).length;
    if (courseCount === 0) return;
    setPlanConfirmDialog({ kind: "clear", courseCount });
  }, [selectedCoursesByDate]);

  const confirmPlanDialog = useCallback(() => {
    if (!planConfirmDialog) return;
    if (planConfirmDialog.kind === "clear") {
      performClearStudyPlan();
      return;
    }
    const { courseId, newStartDate, removeStartDates } = planConfirmDialog;
    setPlanConfirmDialog(null);
    setPlanActionNotice(null);
    const previousCourseId = selectedCoursesByDate[newStartDate];
    const effectType =
      typeof previousCourseId === "number" && previousCourseId !== courseId ? "replace" : "add";
    setSelectedCoursesByDate((current) => {
      const next = { ...current };
      for (const sd of removeStartDates) {
        delete next[sd];
      }
      next[newStartDate] = courseId;
      return next;
    });
    setPlanEntryEffects((current) => ({
      ...current,
      [newStartDate]: effectType
    }));
    window.setTimeout(() => {
      setPlanEntryEffects((current) => {
        if (!current[newStartDate] || current[newStartDate] !== effectType) return current;
        const next = { ...current };
        delete next[newStartDate];
        return next;
      });
    }, 650);
  }, [planConfirmDialog, performClearStudyPlan, selectedCoursesByDate]);

  useEffect(() => {
    if (!planConfirmDialog) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setPlanConfirmDialog(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [planConfirmDialog]);

  useEffect(() => {
    if (!planConfirmDialog) return;
    const id = window.requestAnimationFrame(() => {
      planConfirmCancelRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [planConfirmDialog]);

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

  /** Freie Kalendertage zwischen Kursende (exkl.) und nächstem Kursstart (exkl.), mind. 14 Tage. */
  const planGapRanges = useMemo(() => {
    const ranges: {
      afterStartDate: string;
      from: string;
      to: string;
      nextStartDate: string;
    }[] = [];
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
      ranges.push({
        afterStartDate: previousEntry.startDate,
        from,
        to,
        nextStartDate: currentEntry.startDate
      });
    }
    return ranges;
  }, [plannedEntries]);

  const planGapByAfterStartDate = useMemo(() => {
    return new Map(planGapRanges.map((gap) => [gap.afterStartDate, gap]));
  }, [planGapRanges]);

  const handleJumpGapToStartDate = useCallback(
    (gap: { from: string; to: string; nextStartDate: string }) => {
      const inGap = firstAvailableStartInGap(gap.from, gap.to, initial.availableStartDates);
      const target = inGap ?? gap.nextStartDate;
      handleDateChange(target);
    },
    [handleDateChange, initial.availableStartDates]
  );

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
              {plannedEntries.length > 0 ? (
                <button
                  type="button"
                  className="plan-reset-icon-btn"
                  onClick={openClearStudyPlanDialog}
                  aria-label="Studienplan zurücksetzen"
                  title="Studienplan zurücksetzen"
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
              ) : null}
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
                </div>

                <ul className="plan-course-list">
                  {plannedEntries.map((entry, index) => {
                    const isActiveStartSlot =
                      selectedDate !== "all" && entry.startDate === selectedDate;
                    const isBeforeActiveStartSlot =
                      selectedDate !== "all" &&
                      plannedEntries[index + 1]?.startDate === selectedDate;
                    const gapAfter = planGapByAfterStartDate.get(entry.startDate);
                    return (
                    <Fragment key={`${entry.startDate}-${entry.course.id}`}>
                      <li
                        className={`plan-course-item${
                          planEntryEffects[entry.startDate]
                            ? ` plan-course-item-${planEntryEffects[entry.startDate]}`
                            : ""
                        }${isActiveStartSlot ? " plan-course-item--active-date" : ""}${
                          isBeforeActiveStartSlot ? " plan-course-item--before-active" : ""
                        }${
                          gapAfter ? " plan-course-item--with-gap-after" : ""
                        }`}
                      >
                        <button
                          type="button"
                          className="plan-course-entry-link"
                          onClick={() =>
                            handleJumpToCourseFromPlan(entry.startDate, entry.course.id)
                          }
                          aria-label={`Startdatum ${formatDate(entry.startDate)} wählen und zur Kurskarte scrollen: ${entry.course.title}`}
                        >
                          <span className="plan-course-date">{formatDate(entry.startDate)}</span>
                          <span className="plan-course-title">{entry.course.title}</span>
                          {entry.course.scheduleText ? (
                            <span className="plan-course-detail">{entry.course.scheduleText}</span>
                          ) : null}
                          {entry.course.locationText ? (
                            <span className="plan-course-detail">{entry.course.locationText}</span>
                          ) : null}
                        </button>
                      </li>
                      {gapAfter ? (
                        <li className="plan-gap-item">
                          <button
                            type="button"
                            className="plan-gap-link"
                            onClick={() => handleJumpGapToStartDate(gapAfter)}
                            aria-label={`Zum Startdatum in der Lücke ${formatDate(gapAfter.from)} bis ${formatDate(gapAfter.to)} wechseln`}
                          >
                            <span className="plan-gap-text">
                              Lücke: {formatDate(gapAfter.from)} – {formatDate(gapAfter.to)}
                              <span className="plan-gap-link-hint"> · Termin wählen</span>
                            </span>
                          </button>
                        </li>
                      ) : null}
                    </Fragment>
                    );
                  })}
                </ul>
              </>
            )}
            </div>

          </aside>
        </aside>

        <CourseList
          courses={filteredCourses}
          activeDate={selectedDate}
          selectedByDate={selectedCoursesByDate}
          onAssignCourse={handleAssignCourse}
          onRemoveCourse={handleRemoveCourse}
          isPlannedElsewhere={isPlannedElsewhere}
          isMinimized={(courseId) => minimizedCourseIdSet.has(courseId)}
          onToggleMinimized={toggleCourseMinimized}
          scrollToCourseRequest={scrollToCourseRequest}
          onScrollToCourseHandled={clearScrollToCourseRequest}
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

      {planConfirmDialog ? (
        <div
          className="plan-confirm-backdrop"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setPlanConfirmDialog(null);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={planConfirmTitleId}
            className="plan-confirm-dialog"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id={planConfirmTitleId} className="plan-confirm-title">
              {planConfirmDialog.kind === "clear"
                ? "Studienplan zurücksetzen?"
                : "Kurs zu diesem Termin verschieben?"}
            </h2>
            <p className="plan-confirm-body">
              {planConfirmDialog.kind === "clear" ? (
                <>
                  Alle{" "}
                  <strong>
                    {planConfirmDialog.courseCount}{" "}
                    {planConfirmDialog.courseCount === 1 ? "Kurs" : "Kurse"}
                  </strong>{" "}
                  werden aus dem Plan entfernt. Das kann nicht rückgängig gemacht werden.
                </>
              ) : (
                <>
                  <strong>{coursesById.get(planConfirmDialog.courseId)?.title ?? "Dieser Kurs"}</strong>{" "}
                  ist bereits für{" "}
                  {planConfirmDialog.removeStartDates.map((d) => formatDate(d)).join(", ")} im
                  Studienplan eingetragen. Beim Fortfahren wird{" "}
                  {planConfirmDialog.removeStartDates.length === 1 ? "dieser Eintrag" : "diese Einträge"}{" "}
                  entfernt und der Kurs für{" "}
                  <strong>{formatDate(planConfirmDialog.newStartDate)}</strong> übernommen.
                </>
              )}
            </p>
            <div className="plan-confirm-actions">
              <button
                ref={planConfirmCancelRef}
                type="button"
                className="plan-confirm-btn plan-confirm-btn--secondary"
                onClick={() => setPlanConfirmDialog(null)}
              >
                Abbrechen
              </button>
              <button
                type="button"
                className="plan-confirm-btn plan-confirm-btn--danger"
                onClick={confirmPlanDialog}
              >
                {planConfirmDialog.kind === "clear" ? "Zurücksetzen" : "Übernehmen"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
