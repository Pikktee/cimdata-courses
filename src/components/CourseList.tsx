"use client";

import { useId, useState } from "react";

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

type CourseListProps = {
  courses: CourseItem[];
  activeDate: string;
  selectedByDate: Record<string, number>;
  onAssignCourse: (courseId: number) => void;
  onRemoveCourse: (startDate: string) => void;
  /** Kurs ist bereits unter anderem Termin im Plan (gleicher Titel / gleiche ID). */
  isCourseBlocked?: (courseId: number) => boolean;
};

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}.${month}.${year}`;
}

const MAX_INLINE_START_DATES = 4;
const PREVIEW_BEFORE_MORE = 3;

function CourseStartDates({ startDates }: { startDates: string[] }) {
  const panelId = useId();
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

  return (
    <div className="course-dates-block">
      <span className="course-dates-inline">{head.map(formatDate).join(" · ")}</span>
      <button
        type="button"
        className={`course-dates-toggle${expanded ? " course-dates-toggle--open" : ""}`}
        aria-expanded={expanded}
        aria-controls={panelId}
        onClick={() => setExpanded((v) => !v)}
      >
        <span className="course-dates-toggle-chevron" aria-hidden>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">
            <path d="m6 9 6 6 6-6" />
          </svg>
        </span>
        <span className="course-dates-toggle-label">{expanded ? "Weniger anzeigen" : moreLabel}</span>
      </button>
      <div
        id={panelId}
        className={`course-dates-panel-anim${expanded ? " course-dates-panel-anim--open" : ""}`}
        role="region"
        aria-label="Weitere Starttermine"
        aria-hidden={!expanded}
      >
        <div className="course-dates-panel-inner">
          <ul className="course-dates-expanded-list">
            {tail.map((iso) => (
              <li key={iso}>
                <span className="course-dates-chip">{formatDate(iso)}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

export function CourseList({
  courses,
  activeDate,
  selectedByDate,
  onAssignCourse,
  onRemoveCourse,
  isCourseBlocked
}: CourseListProps) {
  const isDateSelected = activeDate !== "all";

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
    <section className="course-grid" aria-live="polite">
      {courses.map((course) => {
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
            className={`course-card${isDateSelected && isAssigned ? " course-card-in-plan" : ""}`}
            key={course.id}
          >
            <div
              className="course-plan-tooltip-wrap has-tooltip course-card-action"
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
                      d="M7 7h10v10M17 7l-3 3M7 17l3-3"
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
            <p className="course-meta">{course.area ?? "Allgemein"}</p>
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
            </div>
          </article>
        );
      })}
    </section>
  );
}
