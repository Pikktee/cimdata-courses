"use server";

import { revalidatePath } from "next/cache";
import {
  getLatestRefreshRun,
  getLatestSuccessfulRefreshRun,
  refreshCoursesFromSource
} from "@/lib/courses";

type SerializedRefresh = {
  status: string;
  foundCourses: number;
  foundStarts: number;
  startedAt: string;
  finishedAt: string | null;
  message: string | null;
} | null;

function serializeRefresh(
  refresh: {
    status: string;
    foundCourses: number;
    foundStarts: number;
    startedAt: Date;
    finishedAt: Date | null;
    message: string | null;
  } | null
): SerializedRefresh {
  if (!refresh) return null;
  return {
    status: refresh.status,
    foundCourses: refresh.foundCourses,
    foundStarts: refresh.foundStarts,
    startedAt: refresh.startedAt.toISOString(),
    finishedAt: refresh.finishedAt?.toISOString() ?? null,
    message: refresh.message ?? null
  };
}

export async function triggerCourseRefresh() {
  const result = await refreshCoursesFromSource();
  const [latestRefresh, latestSuccessfulRefresh] = await Promise.all([
    getLatestRefreshRun(),
    getLatestSuccessfulRefreshRun()
  ]);

  revalidatePath("/");

  return {
    ok: result.success,
    message: result.success ? null : result.message,
    reason: result.success ? null : result.reason ?? "failed",
    foundCourses: result.success ? result.foundCourses : null,
    foundStarts: result.success ? result.foundStarts : null,
    latestRefresh: serializeRefresh(latestRefresh),
    latestSuccessfulRefresh: serializeRefresh(latestSuccessfulRefresh)
  };
}
