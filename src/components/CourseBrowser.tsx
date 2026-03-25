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

  const handleDateChange = useCallback(
    (value: string) => {
      setSelectedDate(value);
    },
    []
  );

  const filteredCourses = useMemo(() => {
    if (selectedDate === "all") return initial.courses;
    return initial.courses.filter((course) => course.startDates.includes(selectedDate));
  }, [initial.courses, selectedDate]);

  return (
    <>
      <section className="toolbar">
        <DateFilter
          options={initial.availableStartDates}
          value={selectedDate}
          onChange={handleDateChange}
          courseCount={filteredCourses.length}
          disabled={false}
        />
      </section>

      <CourseList courses={filteredCourses} activeDate={selectedDate} />
      <footer className="list-footer" aria-live="polite">
        {initial.latestRefresh && (
          <p className="footer-line">
            Letzter Refresh:{" "}
            {formatDateTime(
              initial.latestRefresh.finishedAt ?? initial.latestRefresh.startedAt
            )} |{" "}
            Status: {formatRefreshStatus(initial.latestRefresh.status)}
          </p>
        )}
      </footer>
    </>
  );
}

