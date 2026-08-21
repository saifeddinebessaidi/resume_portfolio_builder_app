import { NextResponse } from "next/server";
import { categoryCodeSchema } from "@repo/contracts";
import { z } from "zod";

import { isApiProblem } from "@/lib/api/problem";
import { projectsApi } from "@/lib/api/endpoints";

/**
 * Server-side proxy for creating a project.
 *
 * It exists because the session token is in an **httpOnly** cookie: a browser fetch cannot attach it,
 * and making it readable would defeat the reason it is httpOnly. This handler runs on the server where
 * the cookie is available, calls the typed client, and forwards the result.
 *
 * On failure it forwards the API's own problem body verbatim — the code, the detail and the `meta` with
 * `limit` / `used` / `resetsAt`. Rewriting the message here would produce a second, less accurate
 * source of truth for something the API already says well.
 */
const bodySchema = z.object({ categoryCode: categoryCodeSchema }).strict();

export async function POST(request: Request): Promise<NextResponse> {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));

  if (!parsed.success) {
    return NextResponse.json(
      { code: "VALIDATION_FAILED", detail: "Catégorie invalide." },
      { status: 422 },
    );
  }

  try {
    const project = await projectsApi.create({ categoryCode: parsed.data.categoryCode });
    return NextResponse.json(project, { status: 201 });
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
