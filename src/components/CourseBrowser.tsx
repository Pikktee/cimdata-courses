"use client";

import { useCallback, useMemo, useState } from "react";
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
};

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
  const [selectedDate, setSelectedDate] = useState("all");
  const [data, setData] = useState<CoursesResponse>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadCourses = useCallback(async (startDate?: string) => {
    setLoading(true);
    setError(null);

    const search = startDate ? `?startDate=${encodeURIComponent(startDate)}` : "";
    const response = await fetch(`/api/courses${search}`, { cache: "no-store" });
    if (!response.ok) {
      throw new Error("Die Kursdaten konnten nicht geladen werden.");
    }

    const json = (await response.json()) as CoursesResponse;
    setData(json);
    setLoading(false);
  }, []);

  const handleDateChange = useCallback(
    async (value: string) => {
      setSelectedDate(value);
      try {
        await loadCourses(value === "all" ? undefined : value);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unbekannter Fehler");
        setLoading(false);
      }
    },
    [loadCourses]
  );

  const headlineStats = useMemo(() => {
    const countDates = data.availableStartDates.length;
    const countCourses = data.courses.length;
    return `${countDates} Starttermine, ${countCourses} angezeigte Kurse`;
  }, [data]);

  const showStatusPanel = loading || Boolean(error);

  return (
    <>
      <section className="toolbar">
        <DateFilter
          options={data.availableStartDates}
          value={selectedDate}
          onChange={handleDateChange}
          disabled={loading}
        />
      </section>

      {showStatusPanel && (
        <section className="status-panel">
          {loading && <p className="status-primary">Lade Kursdaten...</p>}
          {error && <p className="status-error">{error}</p>}
        </section>
      )}

      <CourseList courses={data.courses} activeDate={selectedDate} />
      <footer className="list-footer" aria-live="polite">
        <p className="footer-line">{headlineStats}</p>
        {data.latestRefresh && (
          <p className="footer-line">
            Letzter Refresh: {formatDateTime(data.latestRefresh.finishedAt ?? data.latestRefresh.startedAt)} |{" "}
            Status: {formatRefreshStatus(data.latestRefresh.status)}
          </p>
        )}
      </footer>
    </>
  );
}

