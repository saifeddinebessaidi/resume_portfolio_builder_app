import { NextResponse } from "next/server";
import { ROUTES } from "@repo/contracts";

import { isApiProblem } from "@/lib/api/problem";
import { request } from "@/lib/api/client";

/**
 * Records an export — which is what **consumes** `EXPORT_PER_PROJECT`.
 *
 * There is no file here. The PDF is produced by the visitor's own browser printing
 * `/resume/:id/print` (ADR-0011), so this endpoint's only job is the quota: it succeeds once per
 * allowance and returns `403 EXPORT_LIMIT_REACHED` after that. The rule lives on the server whether or
 * not a renderer ever exists, which is why the limit was enforceable from phase 2.
 */
export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await context.params;

  try {
    const result = await request<unknown>({
      path: ROUTES.projects.exports(id),
      method: "POST",
      body: { format: "PDF" },
    });
    return NextResponse.json(result, { status: 201 });
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
