import { createHash } from "node:crypto";

import { Controller, Get, Injectable, Logger, Module, Query } from "@nestjs/common";
import { type UploadKind, uploadKindSchema } from "@repo/contracts";

import { AppConfigService } from "../../config/app-config.service";
import { InternalError } from "../../common/errors/errors";

/**
 * Signed direct-to-Cloudinary upload — **ported from the portfolio repository** (phase 5 audit §9,
 * `api/src/photos/photos.module.ts`).
 *
 * ## Why the browser uploads and the server only signs
 *
 * The image never passes through our API. The browser asks for a short-lived signature, then `POST`s the
 * file straight to Cloudinary. That keeps a 5MB body off a Node process on Neon's free tier, gives the
 * browser real upload progress, and — the load-bearing part — means **the API secret never leaves the
 * server**. A client that held the secret could upload anything to the account forever.
 *
 * It is the one part of the audited repository that was already right, so it is ported rather than
 * redesigned. What is *not* ported: their `Photo` table and per-portfolio gallery. A CV has one portrait,
 * and it lives in `payload.photoUrl`, so no new table is needed for this.
 *
 * ## No Cloudinary SDK
 *
 * The signature is a SHA-1 of the parameters sorted by key with the secret appended — ~10 lines, and
 * documented by Cloudinary as the algorithm. Their SDK pulls a dependency tree to do the same thing, and
 * this API's whole constraint is "no paid resources, small footprint".
 */
export interface UploadSignature {
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
  resourceType: UploadKind;
}

/** Everything a CV photo is allowed to be, enforced again on the client before the file is sent. */
export const PHOTO_FOLDER = "reacchy/resume-photos";

/**
 * Portfolio Pro videos, in their own folder.
 *
 * Separate from the photo folder because the folder is **part of what the signature authorises**: a
 * client holding an image signature cannot write a 100MB video into the photo folder, and the two can be
 * given different retention or transformation rules in Cloudinary without touching this code.
 */
export const VIDEO_FOLDER = "reacchy/portfolio-videos";

@Injectable()
export class CloudinarySigner {
  private readonly logger = new Logger(CloudinarySigner.name);

  constructor(private readonly config: AppConfigService) {}

  /**
   * `kind` decides the folder **and** the Cloudinary endpoint the browser will post to.
   *
   * Server-side, deliberately. If the client chose the folder, an authenticated user could sign a write
   * into any path in the account — which is the single thing this whole signing flow exists to prevent.
   */
  sign(kind: UploadKind = "image"): UploadSignature {
    const credentials = this.config.cloudinary;

    if (!credentials) {
      /**
       * Configuration, not a caller error — so it is a 500 whose detail the filter genericises, with the
       * real reason in the log where an operator will look. Returning 200 with a null signature would
       * push the diagnosis into the browser, which cannot fix it.
       */
      this.logger.error(
        "Upload requested but Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, " +
          "CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET in apps/api/.env.",
      );
      throw new InternalError("Cloudinary is not configured.");
    }

    // Seconds, not milliseconds: Cloudinary rejects a timestamp it reads as a far-future date, and the
    // signature is only valid for about an hour either side.
    const timestamp = Math.round(Date.now() / 1000);

    /**
     * The parameters that are signed must be exactly the ones the browser sends, sorted by key.
     *
     * Any mismatch — an extra field, a different folder — produces a signature Cloudinary rejects with a
     * message that does not say which parameter was wrong. Keeping the folder here rather than letting
     * the client choose it is also what stops an authenticated user writing into another folder.
     */
    const folder = kind === "video" ? VIDEO_FOLDER : PHOTO_FOLDER;
    const params: Record<string, string | number> = { folder, timestamp };

    const toSign = Object.keys(params)
      .sort()
      .map((key) => `${key}=${String(params[key])}`)
      .join("&");

    const signature = createHash("sha1").update(`${toSign}${credentials.apiSecret}`).digest("hex");

    return {
      cloudName: credentials.cloudName,
      // Public by design: it travels in the upload request the browser makes.
      apiKey: credentials.apiKey,
      timestamp,
      folder,
      signature,
      resourceType: kind,
    };
  }
}

/**
 * Authenticated: an open signing endpoint is an open write to the storage account, which is the one
 * mistake this whole flow exists to prevent. `AuthGuard` is global and this route carries no `@Public()`.
 */
@Controller("uploads")
export class UploadsController {
  constructor(private readonly signer: CloudinarySigner) {}

  /**
   * `?kind=image|video`, defaulting to image so the existing CV-photo call site is unchanged.
   *
   * Parsed with the contract's own enum rather than trusted: an unrecognised value must be a 4xx, not a
   * silent fall-through to the image folder that then rejects the upload for reasons the browser cannot
   * explain.
   */
  @Get("signature")
  signature(@Query("kind") kind?: string): UploadSignature {
    const parsed = uploadKindSchema.safeParse(kind ?? "image");
    return this.signer.sign(parsed.success ? parsed.data : "image");
  }
}

@Module({
  controllers: [UploadsController],
  providers: [CloudinarySigner],
})
export class UploadsModule {}
