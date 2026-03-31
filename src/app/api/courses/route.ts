import { NextRequest, NextResponse } from "next/server";
import {
  getCoursesByStartDate,
  getLatestRefreshRun,
  getLatestSuccessfulRefreshRun
} from "@/lib/courses";

export async function GET(request: NextRequest) {
  const startDate = request.nextUrl.searchParams.get("startDate");
  const [data, latestRefresh, latestSuccessfulRefresh] = await Promise.all([
    getCoursesByStartDate(startDate),
    getLatestRefreshRun(),
    getLatestSuccessfulRefreshRun()
  ]);

  return NextResponse.json({
    ...data,
    latestRefresh: latestRefresh
      ? {
          status: latestRefresh.status,
          foundCourses: latestRefresh.foundCourses,
          foundStarts: latestRefresh.foundStarts,
          startedAt: latestRefresh.startedAt.toISOString(),
          finishedAt: latestRefresh.finishedAt?.toISOString() ?? null,
          message: latestRefresh.message ?? null
        }
      : null,
    latestSuccessfulRefresh: latestSuccessfulRefresh
      ? {
          status: latestSuccessfulRefresh.status,
          foundCourses: latestSuccessfulRefresh.foundCourses,
          foundStarts: latestSuccessfulRefresh.foundStarts,
          startedAt: latestSuccessfulRefresh.startedAt.toISOString(),
          finishedAt: latestSuccessfulRefresh.finishedAt?.toISOString() ?? null,
          message: latestSuccessfulRefresh.message ?? null
        }
      : null
  });
}
