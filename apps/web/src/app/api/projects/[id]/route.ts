import { NextResponse } from "next/server";
import { updateProjectRequestSchema } from "@repo/contracts";

import { isApiProblem } from "@/lib/api/problem";
import { projectsApi } from "@/lib/api/endpoints";

/**
 * Server-side proxy for saving a project.
 *
 * Exists for the same reason as the create proxy: the bearer token is in an httpOnly cookie the browser
 * cannot attach, so the write has to originate server-side.
 *
 * The body is validated here against the shared contract **before** the API sees it, which turns a
 * malformed editor payload into a 422 with field paths rather than a round trip. The API validates again
 * — this is a convenience, not the authority.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const parsed = updateProjectRequestSchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      {
        code: "VALIDATION_FAILED",
        detail: "Données invalides.",
        meta: {
          issues: parsed.error.issues.map((i) => ({
            path: i.path.map(String).join("."),
            message: i.message,
          })),
        },
      },
      { status: 422 },
    );
  }

  try {
    const project = await projectsApi.update(id, parsed.data);
    return NextResponse.json(project);
  } catch (error) {
    if (isApiProblem(error)) {
      return NextResponse.json(
        { code: error.code, detail: error.detail, meta: error.meta },
        { status: error.status },
      );
    }
    throw error;
  }
}
