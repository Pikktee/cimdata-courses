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
  favoriteCourseIds: number[];
  onAssignCourse: (courseId: number, startDate: string) => void;
  onRemoveCourse: (startDate: string) => void;
  onToggleFavorite: (courseId: number) => void;
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
  favoriteCourseIds,
  onAssignCourse,
  onRemoveCourse,
  onToggleFavorite
}: CourseListProps) {
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
      {courses.map((course) => (
        <article className="course-card" key={course.id}>
          <div className="course-card-head">
            <h3>{course.title}</h3>
            <button
              type="button"
              className={`favorite-btn ${
                favoriteCourseIds.includes(course.id) ? "favorite-btn-active" : ""
              }`}
              aria-pressed={favoriteCourseIds.includes(course.id)}
              onClick={() => onToggleFavorite(course.id)}
            >
              {favoriteCourseIds.includes(course.id) ? "★ Favorit" : "☆ Merken"}
            </button>
          </div>
          <p className="course-meta">{course.area ?? "Bereich nicht angegeben"}</p>
          <ul>
            <li>
              <strong>Dauer:</strong> {course.durationText ?? "k. A."}
            </li>
            <li>
              <strong>Starttermine:</strong> {course.startDates.length || "k. A."}
            </li>
          </ul>
          <div className="course-date-actions">
            {course.startDates.slice().sort().map((startDate) => {
              const selectedCourseId = selectedByDate[startDate];
              const isSelected = selectedCourseId === course.id;
              const isReplacing =
                typeof selectedCourseId === "number" && selectedCourseId !== course.id;
              const buttonLabel = isSelected
                ? "Entfernen"
                : isReplacing
                  ? "Ersetzen"
                  : "Hinzufügen";

              return (
                <div className="course-date-row" key={`${course.id}-${startDate}`}>
                  <span className="course-date-chip">{formatDate(startDate)}</span>
                  <button
                    type="button"
                    className={`course-action-btn ${
                      isSelected
                        ? "course-action-btn-remove"
                        : isReplacing
                          ? "course-action-btn-replace"
                          : "course-action-btn-add"
                    }`}
                    onClick={() =>
                      isSelected
                        ? onRemoveCourse(startDate)
                        : onAssignCourse(course.id, startDate)
                    }
                  >
                    {buttonLabel}
                  </button>
                </div>
              );
            })}
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
      ))}
    </section>
  );
}
