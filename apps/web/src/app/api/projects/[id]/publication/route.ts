import { NextResponse } from "next/server";
import { publishRequestSchema } from "@repo/contracts";

import { isApiProblem } from "@/lib/api/problem";
import { projectsApi } from "@/lib/api/endpoints";

/**
 * Server-side proxy for publishing.
 *
 * Same reason as the other project write proxies: the bearer token is in an httpOnly cookie the browser
 * cannot attach, so the call has to originate server-side.
 *
 * Forwards the API's problem body verbatim on failure. Publishing is entitlement-gated
 * (`PUBLICATION_SLOT`, `CUSTOM_SLUG`, `HOSTING_DAYS`), so the response carries the numbers the UI needs
 * to explain a refusal — rewriting the message here would produce a second, less accurate source.
 */
export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;
  const parsed = publishRequestSchema.safeParse(await request.json().catch(() => ({})));

  if (!parsed.success) {
    return NextResponse.json(
      { code: "VALIDATION_FAILED", detail: "Lien personnalisé invalide." },
      { status: 422 },
    );
  }

  try {
    return NextResponse.json(await projectsApi.publish(id, parsed.data));
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
