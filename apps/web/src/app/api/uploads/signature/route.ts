import { NextResponse } from "next/server";

import { isApiProblem } from "@/lib/api/problem";
import { uploadsApi } from "@/lib/api/endpoints";

/**
 * Server-side proxy for the upload signature.
 *
 * Same reason as the project write proxies: the bearer token lives in an httpOnly cookie the browser
 * cannot attach, so an authenticated request has to originate server-side.
 *
 * What crosses to the browser is a **short-lived signature plus the public cloud name and API key** —
 * never the secret, which stays in the API process. See `uploads.module.ts`.
 */
export async function GET(request: Request): Promise<NextResponse> {
  /**
   * `?kind=video` for a Portfolio Pro reel, anything else for an image.
   *
   * Not validated here beyond the one comparison: the API parses it with the contract's enum and falls
   * back to `image`, so a bad value cannot reach Cloudinary. Re-validating in the proxy would be a second
   * place for the two to disagree.
   */
  const kind = new URL(request.url).searchParams.get("kind") === "video" ? "video" : "image";

  try {
    return NextResponse.json(await uploadsApi.signature(kind));
  } catch (error) {
    if (isApiProblem(error)) {
      return NextResponse.json(
        { code: error.code, detail: error.detail },
        { status: error.status },
      );
    }
    throw error;
  }
}
