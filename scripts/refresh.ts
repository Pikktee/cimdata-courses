import { refreshCoursesFromSource } from "@/lib/courses";

async function main() {
  const result = await refreshCoursesFromSource();
  if (!result.success) {
    console.error(result.message ?? "Refresh fehlgeschlagen.");
    process.exit(1);
  }

  console.log(
    JSON.stringify(
      {
        success: true,
        foundCourses: result.foundCourses,
        foundStarts: result.foundStarts
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

