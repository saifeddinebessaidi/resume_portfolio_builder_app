import { NextResponse } from "next/server";
import { generatePortfolioContentRequestSchema } from "@repo/contracts";

import { isApiProblem } from "@/lib/api/problem";
import { projectsApi } from "@/lib/api/endpoints";

/**
 * Server-side proxy for portfolio content generation.
 *
 * Same reason as the other project write proxies — the bearer token is in an httpOnly cookie that script
 * cannot read, so the call has to originate server-side. And a second reason specific to this one: the
 * generation credential lives on the API. Nothing in this path ever holds `AI_API_KEY`, and a browser
 * that could reach the provider directly would be spending a billable key in public.
 *
 * The API's problem body is forwarded verbatim. A refusal here is informative — "renseignez d'abord votre
 * nom complet", "réessayez" after a provider timeout — and rewriting it would produce a second, less
 * accurate source of the same message.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const parsed = generatePortfolioContentRequestSchema.safeParse(
    await request.json().catch(() => ({})),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { code: "VALIDATION_FAILED", detail: "Requête de génération invalide." },
      { status: 422 },
    );
  }

  try {
    return NextResponse.json(await projectsApi.generatePortfolioContent(id, parsed.data));
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
