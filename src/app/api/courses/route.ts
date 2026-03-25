import { NextRequest, NextResponse } from "next/server";
import { getCoursesByStartDate, getLatestRefreshRun } from "@/lib/courses";

export async function GET(request: NextRequest) {
  const startDate = request.nextUrl.searchParams.get("startDate");
  const data = await getCoursesByStartDate(startDate);
  const latestRefresh = await getLatestRefreshRun();

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
      : null
  });
}
