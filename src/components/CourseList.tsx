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
  onAssignCourse,
  onRemoveCourse
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
        const actionLabel = !isDateSelected
          ? "Startdatum wählen"
          : isAssigned
            ? "Bereits im Studienplan"
            : isReplacing
              ? "Für Termin ersetzen"
              : "In Studienplan aufnehmen";
        const actionTooltip = !isDateSelected
          ? "Bitte zuerst in der linken Spalte ein konkretes Startdatum wählen."
          : isAssigned
            ? "Kurs für dieses Startdatum aus dem Studienplan entfernen."
            : isReplacing
              ? "Kurs für dieses Startdatum im Studienplan ersetzen."
              : "Kurs für dieses Startdatum in den Studienplan aufnehmen.";

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
              <div className="course-plan-row">
                <div
                  className="course-plan-tooltip-wrap has-tooltip"
                  data-tooltip={actionTooltip}
                >
                  <button
                    type="button"
                    className={`course-plan-icon-btn ${
                      isAssigned
                        ? "course-plan-icon-btn-remove"
                        : isReplacing
                          ? "course-plan-icon-btn-replace"
                          : "course-plan-icon-btn-add"
                    }`}
                    disabled={!isDateSelected}
                    onClick={() =>
                      isAssigned ? onRemoveCourse(activeDate) : onAssignCourse(course.id)
                    }
                    aria-label={actionLabel}
                  >
                    {isAssigned ? (
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
                    ) : isReplacing ? (
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
              </div>
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
