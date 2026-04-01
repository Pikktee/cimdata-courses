"use client";

import { useEffect, useRef, useState } from "react";

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

type ScrollToCourseRequest = {
  courseId: number;
  requestId: number;
};

type CourseListProps = {
  courses: CourseItem[];
  activeDate: string;
  selectedByDate: Record<string, number>;
  onAssignCourse: (courseId: number) => void;
  onRemoveCourse: (startDate: string) => void;
  onToggleMinimized: (courseId: number) => void;
  isMinimized: (courseId: number) => boolean;
  /** Kurs ist bereits unter anderem Termin im Plan (gleicher Titel / gleiche ID). */
  isCourseBlocked?: (courseId: number) => boolean;
  scrollToCourseRequest?: ScrollToCourseRequest | null;
  onScrollToCourseHandled?: () => void;
};

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}.${month}.${year}`;
}

const MAX_INLINE_START_DATES = 4;
const PREVIEW_BEFORE_MORE = 3;

function CourseStartDates({ startDates }: { startDates: string[] }) {
  const [expanded, setExpanded] = useState(false);

  if (!startDates.length) {
    return <>k. A.</>;
  }

  const sorted = [...startDates].sort((a, b) => a.localeCompare(b));

  if (sorted.length <= MAX_INLINE_START_DATES) {
    return (
      <span className="course-dates-inline">{sorted.map(formatDate).join(" · ")}</span>
    );
  }

  const head = sorted.slice(0, PREVIEW_BEFORE_MORE);
  const tail = sorted.slice(PREVIEW_BEFORE_MORE);
  const moreLabel =
    tail.length === 1 ? "1 weiterer Termin" : `${tail.length} weitere Termine`;

  if (expanded) {
    return (
      <span className="course-dates-inline">{sorted.map(formatDate).join(" · ")}</span>
    );
  }

  return (
    <span className="course-dates-block">
      <span className="course-dates-inline">{head.map(formatDate).join(" · ")}</span>
      <button
        type="button"
        className="course-dates-more-link"
        onClick={() => setExpanded(true)}
        aria-label={`${moreLabel} anzeigen`}
        title={moreLabel}
      >
        <svg viewBox="0 0 24 24" aria-hidden>
          <circle cx="5" cy="12" r="1.7" fill="currentColor" />
          <circle cx="12" cy="12" r="1.7" fill="currentColor" />
          <circle cx="19" cy="12" r="1.7" fill="currentColor" />
        </svg>
      </button>
    </span>
  );
}

export function CourseList({
  courses,
  activeDate,
  selectedByDate,
  onAssignCourse,
  onRemoveCourse,
  onToggleMinimized,
  isMinimized,
  isCourseBlocked,
  scrollToCourseRequest,
  onScrollToCourseHandled
}: CourseListProps) {
  const isDateSelected = activeDate !== "all";
  const [minimizingCourseIds, setMinimizingCourseIds] = useState<number[]>([]);
  const minimizeTimeoutsRef = useRef<number[]>([]);
  const visibleCourses = courses.filter((course) => !isMinimized(course.id));
  const minimizedCourses = courses.filter((course) => isMinimized(course.id));

  useEffect(() => {
    return () => {
      minimizeTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, []);

  useEffect(() => {
    if (!scrollToCourseRequest || !onScrollToCourseHandled) return;
    const { courseId } = scrollToCourseRequest;
    const timeoutIds: number[] = [];
    let cancelled = false;
    let attempts = 0;
    const maxAttempts = 18;

    const tick = () => {
      if (cancelled) return;
      const el = document.getElementById(`course-card-${courseId}`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        onScrollToCourseHandled();
        return;
      }
      attempts += 1;
      if (attempts >= maxAttempts) {
        onScrollToCourseHandled();
        return;
      }
      timeoutIds.push(window.setTimeout(tick, 55));
    };

    let innerRaf = 0;
    const outerRaf = requestAnimationFrame(() => {
      innerRaf = requestAnimationFrame(tick);
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(outerRaf);
      cancelAnimationFrame(innerRaf);
      timeoutIds.forEach((id) => window.clearTimeout(id));
    };
  }, [scrollToCourseRequest, onScrollToCourseHandled]);

  const startMinimize = (courseId: number) => {
    if (minimizingCourseIds.includes(courseId)) return;
    setMinimizingCourseIds((current) => [...current, courseId]);
    const timeoutId = window.setTimeout(() => {
      onToggleMinimized(courseId);
      setMinimizingCourseIds((current) => current.filter((id) => id !== courseId));
      minimizeTimeoutsRef.current = minimizeTimeoutsRef.current.filter((id) => id !== timeoutId);
    }, 180);
    minimizeTimeoutsRef.current.push(timeoutId);
  };

  if (courses.length === 0) {
    return (
      <section className="empty-state">
        <h2>Keine Kurse gefunden</h2>
        <p>
          {activeDate === "all"
            ? "Aktuell wurden keine Kurse gefunden."
            : `Für den Termin ${formatDate(activeDate)} wurden aktuell keine Kurse gefunden.`}
        </p>
      </section>
    );
  }

  return (
    <section className="course-list-stack" aria-live="polite">
      {visibleCourses.length > 0 ? (
        <div className="course-grid">
          {visibleCourses.map((course) => {
            const assignedCourseId = isDateSelected ? selectedByDate[activeDate] : undefined;
            const isAssigned = assignedCourseId === course.id;
            const isReplacing = typeof assignedCourseId === "number" && assignedCourseId !== course.id;
            const isDuplicateElsewhere = Boolean(isCourseBlocked?.(course.id));
            const actionBlocked = isDuplicateElsewhere && !isAssigned;
            const formattedActiveDate = isDateSelected ? formatDate(activeDate) : null;
            const actionLabel = !isDateSelected
              ? "Startdatum wählen"
              : isAssigned
                ? "Bereits im Studienplan"
                : actionBlocked
                  ? "Bereits anderer Termin im Studienplan"
                  : isReplacing
                    ? "Für Termin ersetzen"
                    : "In Studienplan aufnehmen";
            const actionTooltip = !isDateSelected
              ? "Bitte zuerst in der linken Spalte ein konkretes Startdatum wählen."
              : isAssigned
                ? `Kurs am ${formattedActiveDate} aus dem Studienplan entfernen.`
                : actionBlocked
                  ? "Dieser Kurs ist bereits für einen anderen Termin im Studienplan. Entferne den bestehenden Eintrag oder wähle einen anderen Kurs."
                  : isReplacing
                    ? `Kurs für ${formattedActiveDate} im Studienplan ersetzen.`
                    : `Kurs für ${formattedActiveDate} in den Studienplan aufnehmen.`;
            const showRemove = isAssigned;
            const showReplace = isReplacing && !actionBlocked;

            return (
              <article
                id={`course-card-${course.id}`}
                className={`course-card${isDateSelected && isAssigned ? " course-card-in-plan" : ""}${minimizingCourseIds.includes(course.id) ? " course-card-minimizing" : ""}`}
                key={course.id}
              >
                <div className="course-card-corner">
                  <div
                    className="course-plan-tooltip-wrap has-tooltip course-card-action-minimize"
                    data-tooltip="Kurs minimieren"
                  >
                    <button
                      type="button"
                      className="course-minimize-btn"
                      onClick={() => startMinimize(course.id)}
                      aria-label="Kurs minimieren"
                    >
                      <svg viewBox="0 0 24 24" aria-hidden>
                        <path
                          d="M5 12h14"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    </button>
                  </div>
                </div>
                <div className="course-meta-row">
                  <p className="course-meta">{course.area ?? "Allgemein"}</p>
                </div>
                <h3>{course.title}</h3>
                <dl className="course-details">
                  <div className="course-detail-row">
                    <dt>
                      <svg viewBox="0 0 24 24" aria-hidden>
                        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M12 6v6l4 2" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      Dauer
                    </dt>
                    <dd>{course.durationText ?? "k. A."}</dd>
                  </div>
                  <div className="course-detail-row">
                    <dt>
                      <svg viewBox="0 0 24 24" aria-hidden>
                        <rect x="3" y="4" width="18" height="18" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
                        <path d="M16 2v4M8 2v4M3 10h18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                      </svg>
                      Termine
                    </dt>
                    <dd>
                      <CourseStartDates startDates={course.startDates} />
                    </dd>
                  </div>
                </dl>
                <div className="course-card-footer">
                  <a className="course-link" href={course.url} target="_blank" rel="noreferrer">
                    <span className="course-link-text">Kurs bei CIMDATA</span>
                    <span className="course-link-icon" aria-hidden>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                        <path d="M15 3h6v6" />
                        <path d="M10 14 21 3" />
                      </svg>
                    </span>
                  </a>
                  <div
                    className="course-plan-tooltip-wrap has-tooltip course-card-footer-actions"
                    data-tooltip={actionTooltip}
                  >
                    <button
                      type="button"
                      className={`course-plan-icon-btn ${
                        showRemove
                          ? "course-plan-icon-btn-remove"
                          : showReplace
                            ? "course-plan-icon-btn-replace"
                            : "course-plan-icon-btn-add"
                      }`}
                      disabled={!isDateSelected || actionBlocked}
                      onClick={() =>
                        showRemove ? onRemoveCourse(activeDate) : onAssignCourse(course.id)
                      }
                      aria-label={actionLabel}
                    >
                      {showRemove ? (
                        <svg viewBox="0 0 24 24" aria-hidden>
                          <path
                            d="M3 6h18M8 6v14h8V6M10 6V4h4v2"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : showReplace ? (
                        <svg viewBox="0 0 24 24" aria-hidden>
                          <path
                            d="M4 8h12M12 4l4 4-4 4M20 16H8M12 12l-4 4 4 4"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" aria-hidden>
                          <path
                            d="M12 5v14M5 12h14"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      )}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <section className="empty-state">
          <h2>Alle sichtbaren Kurse sind minimiert</h2>
          <p>Nutze den Bereich „Ausgeblendete Kurse“, um Kurse wieder einzublenden.</p>
        </section>
      )}

      {minimizedCourses.length > 0 && (
        <section className="minimized-courses-panel" aria-label="Ausgeblendete Kurse">
          <div className="minimized-courses-head">
            <h2>Ausgeblendete Kurse</h2>
            <span>{minimizedCourses.length}</span>
          </div>
          <ul className="minimized-courses-list">
            {minimizedCourses.map((course) => (
              <li key={course.id} className="minimized-course-item">
                <div className="minimized-course-main">
                  <p className="minimized-course-title">{course.title}</p>
                  <p className="minimized-course-meta">{course.area ?? "Allgemein"}</p>
                </div>
                <div className="minimized-course-actions">
                  <button
                    type="button"
                    className="minimized-restore-btn"
                    onClick={() => onToggleMinimized(course.id)}
                  >
                    Einblenden
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </section>
  );
}
