import { NextRequest, NextResponse } from "next/server";
import { refreshCoursesFromSource } from "@/lib/courses";

/** Laufzeit für Scraping + DB (Vercel cappt je nach Plan automatisch). */
export const maxDuration = 60;

export const dynamic = "force-dynamic";

/** Verhindert Caching von API-Antworten an der Edge (u. a. nach Deploy/Route-Änderung). */
const noStoreHeaders = {
  "Cache-Control": "private, no-store, max-age=0, must-revalidate"
} as const;

function isAuthorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return new NextResponse("Unauthorized", { status: 401, headers: noStoreHeaders });
  }

  try {
    const result = await refreshCoursesFromSource();
    if (!result.success) {
      return NextResponse.json(
        { ok: false, error: result.message },
        { status: 500, headers: noStoreHeaders }
      );
    }
    return NextResponse.json(
      {
        ok: true,
        foundCourses: result.foundCourses,
        foundStarts: result.foundStarts
      },
      { headers: noStoreHeaders }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500, headers: noStoreHeaders }
    );
  }
}
