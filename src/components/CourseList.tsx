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
            <div
              className="course-plan-tooltip-wrap has-tooltip course-card-action"
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
                onClick={() => (isAssigned ? onRemoveCourse(activeDate) : onAssignCourse(course.id))}
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
                <dd>{course.startDates.length || "k. A."}</dd>
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
