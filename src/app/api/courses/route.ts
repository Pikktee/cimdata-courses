import { NextRequest, NextResponse } from "next/server";
import {
  getCoursesByStartDate,
  getLatestRefreshRun,
  getLatestSuccessfulRefreshRun,
  isIsoDate,
  toPublicRefreshRun
} from "@/lib/courses";

export async function GET(request: NextRequest) {
  const startDate = request.nextUrl.searchParams.get("startDate");
  if (startDate !== null && !isIsoDate(startDate)) {
    return NextResponse.json(
      { error: "startDate muss ein Datum im Format JJJJ-MM-TT sein." },
      { status: 400 }
    );
  }

  const [data, latestRefresh, latestSuccessfulRefresh] = await Promise.all([
    getCoursesByStartDate(startDate),
    getLatestRefreshRun(),
    getLatestSuccessfulRefreshRun()
  ]);

  return NextResponse.json({
    ...data,
    latestRefresh: toPublicRefreshRun(latestRefresh),
    latestSuccessfulRefresh: toPublicRefreshRun(latestSuccessfulRefresh)
  });
}
