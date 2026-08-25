import { NextResponse } from "next/server";

import { isApiProblem } from "@/lib/api/problem";
import { projectsApi } from "@/lib/api/endpoints";

/**
 * Server-side proxy for CV « Profil » generation.
 *
 * Same two reasons as the portfolio proxy beside it. The bearer token is in an httpOnly cookie that
 * script cannot read, so the call has to originate server-side — and the generation credential lives on
 * the API, so nothing in this path ever holds `AI_API_KEY`. A browser that could reach the provider
 * directly would be spending a billable key in public.
 *
 * **No body to validate**, unlike the portfolio route: a Profil is generated once per CV, so there is no
 * `replaceExisting` for the client to send. Anything posted here is ignored rather than rejected —
 * refusing a body the endpoint does not read would be a 422 that tells the caller nothing useful.
 *
 * The API's problem body is forwarded verbatim. A refusal here is informative — "renseignez d'abord
 * votre titre professionnel", "réessayez" after a provider timeout — and rewriting it would produce a
 * second, less accurate source of the same message.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;

  try {
    return NextResponse.json(await projectsApi.generateResumeSummary(id));
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
