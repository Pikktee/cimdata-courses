import { useMemo, useState } from "react";

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
  onAssignCourse: (courseId: number, startDate: string) => void;
};

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}.${month}.${year}`;
}

export function CourseList({
  courses,
  activeDate,
  selectedByDate,
  onAssignCourse
}: CourseListProps) {
  const [plannedDateByCourse, setPlannedDateByCourse] = useState<Record<number, string>>({});

  const sortedCourses = useMemo(
    () =>
      courses.map((course) => ({
        ...course,
        startDates: course.startDates.slice().sort((a, b) => a.localeCompare(b))
      })),
    [courses]
  );

  const getSelectedDate = (course: CourseItem): string => {
    const preferred = plannedDateByCourse[course.id];
    if (preferred && course.startDates.includes(preferred)) return preferred;
    if (activeDate !== "all" && course.startDates.includes(activeDate)) return activeDate;
    return course.startDates[0] ?? "";
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
    <section className="course-grid" aria-live="polite">
      {sortedCourses.map((course) => {
        const selectedStartDate = getSelectedDate(course);
        const assignedCourseId = selectedByDate[selectedStartDate];
        const isAssigned = assignedCourseId === course.id;
        const isReplacing = typeof assignedCourseId === "number" && assignedCourseId !== course.id;
        const actionLabel = isAssigned
          ? "Bereits im Studienplan"
          : isReplacing
            ? "Für Termin ersetzen"
            : "In Studienplan aufnehmen";

        return (
        <article className="course-card" key={course.id}>
          <h3>{course.title}</h3>
          <p className="course-meta">{course.area ?? "Bereich nicht angegeben"}</p>
          <ul>
            <li>
              <strong>Dauer:</strong> {course.durationText ?? "k. A."}
            </li>
            <li>
              <strong>Starttermine:</strong> {course.startDates.length || "k. A."}
            </li>
          </ul>
          <div className="course-plan-controls">
            <label htmlFor={`startdate-${course.id}`} className="course-plan-label">
              Termin für Studienplan
            </label>
            <div className="course-plan-row">
              <select
                id={`startdate-${course.id}`}
                className="course-plan-select"
                value={selectedStartDate}
                onChange={(event) =>
                  setPlannedDateByCourse((current) => ({
                    ...current,
                    [course.id]: event.target.value
                  }))
                }
              >
                {course.startDates.map((startDate) => (
                  <option key={`${course.id}-${startDate}`} value={startDate}>
                    {formatDate(startDate)}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={`course-plan-primary-btn ${
                  isReplacing ? "course-plan-primary-btn-replace" : ""
                }`}
                disabled={isAssigned || !selectedStartDate}
                onClick={() => onAssignCourse(course.id, selectedStartDate)}
              >
                {actionLabel}
              </button>
            </div>
            {isAssigned && (
              <p className="course-plan-note">
                Dieser Kurs ist für den ausgewählten Termin bereits im Studienplan.
              </p>
            )}
            {isReplacing && (
              <p className="course-plan-note course-plan-note-warning">
                Für diesen Termin ist bereits ein anderer Kurs geplant und wird ersetzt.
              </p>
            )}
          </div>
          <div className="course-card-footer">
            <a className="course-link" href={course.url} target="_blank" rel="noreferrer">
              <span className="course-link-text">Kurs bei CIMDATA öffnen</span>
              <span className="course-link-icon" aria-hidden>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
