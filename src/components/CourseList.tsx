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
};

function formatDate(isoDate: string): string {
  const [year, month, day] = isoDate.split("-");
  if (!year || !month || !day) return isoDate;
  return `${day}.${month}.${year}`;
}

export function CourseList({ courses, activeDate }: CourseListProps) {
  if (!activeDate) {
    return (
      <section className="empty-state">
        <h2>Kein Startdatum ausgewählt</h2>
        <p>Wähle ein konkretes Startdatum aus der Liste, um passende Kurse anzuzeigen.</p>
      </section>
    );
  }

  if (courses.length === 0) {
    return (
      <section className="empty-state">
        <h2>Keine Kurse gefunden</h2>
        <p>Für den Termin {formatDate(activeDate)} wurden aktuell keine Kurse gefunden.</p>
      </section>
    );
  }

  return (
    <section className="course-grid" aria-live="polite">
      {courses.map((course) => (
        <article className="course-card" key={course.id}>
          <h3>{course.title}</h3>
          <p className="course-meta">{course.area ?? "Bereich nicht angegeben"}</p>
          <ul>
            <li>
              <strong>Dauer:</strong> {course.durationText ?? "k. A."}
            </li>
            <li>
              <strong>Unterricht:</strong> {course.scheduleText ?? "k. A."}
            </li>
            <li>
              <strong>Ort:</strong> {course.locationText ?? "k. A."}
            </li>
            <li>
              <strong>Starttermine:</strong>{" "}
              {course.startDates.map(formatDate).join(", ") || "k. A."}
            </li>
          </ul>
          <a className="course-link" href={course.url} target="_blank" rel="noreferrer">
            Kurs bei CIMDATA öffnen
          </a>
        </article>
      ))}
    </section>
  );
}
