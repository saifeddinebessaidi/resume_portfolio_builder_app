"use client";

import {
  RESUME_PHOTO_MAX_BYTES,
  RESUME_PHOTO_MIME_TYPES,
  type UploadSignature,
} from "@repo/contracts";
import { ImageUp, Trash2 } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { messages } from "@/messages/fr";

/**
 * The CV portrait — **European templates only**.
 *
 * A photo on a North-American résumé is a liability rather than a feature: US and Canadian employers
 * routinely discard CVs carrying one, because a hiring file that records apparent age, race or gender
 * creates discrimination exposure they would rather not have. European practice is the opposite, and
 * every one of the three designs you shared has a place for one. So the field is rendered per-convention
 * rather than always — which is the same reason the picker asks for the convention first.
 *
 * ## The upload path, ported from the portfolio repository
 *
 * Browser asks our server for a signature, then `POST`s the file **straight to Cloudinary**. The image
 * never passes through our API: no 5MB body on a Node process, real progress from `XMLHttpRequest`, and
 * the API secret never leaves the server. This is the one part of that repository that was already right
 * (phase 5 audit §9), so it is ported rather than redesigned.
 *
 * `XMLHttpRequest` and not `fetch`, for the reason the original gives: `fetch` cannot report **upload**
 * progress, and a portrait on a Tunisian mobile connection is exactly where a progress bar earns itself.
 *
 * ## Validated here *and* meaningfully server-side
 *
 * The size and MIME checks below are a courtesy — they save a doomed round trip. The real limits are the
 * signed `folder`, which the client cannot change, and Cloudinary's own account settings. Client-side
 * validation alone was one of the two gaps the audit flagged in the original (§9), and it is worth being
 * explicit that this file does not close it: what closes it is that a signature is required at all.
 */
export function PhotoField({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (photoUrl: string | undefined) => void;
}): ReactNode {
  const input = useRef<HTMLInputElement>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const upload = async (file: File): Promise<void> => {
    setError(null);

    if (!(RESUME_PHOTO_MIME_TYPES as readonly string[]).includes(file.type)) {
      setError(messages.resume.photoWrongType);
      return;
    }
    if (file.size > RESUME_PHOTO_MAX_BYTES) {
      setError(messages.resume.photoTooLarge);
      return;
    }

    setProgress(0);

    try {
      const response = await fetch("/api/uploads/signature");
      if (!response.ok) {
        // The most likely cause by far: CLOUDINARY_API_SECRET is not set. Say so plainly rather than
        // showing a generic failure the user cannot act on.
        setError(messages.resume.photoNotConfigured);
        setProgress(null);
        return;
      }

      const sig = (await response.json()) as UploadSignature;
      const url = await postToCloudinary(file, sig, setProgress);
      onChange(url);
    } catch {
      setError(messages.resume.photoFailed);
    } finally {
      setProgress(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">{messages.resume.photo}</span>

      <div className="flex items-center gap-3">
        {/* A plain <img>: this is a Cloudinary URL on an arbitrary host, and next/image would need
            every such host in next.config. The preview is 56px, so optimisation buys nothing. */}
        {value ? (
          <img
            src={value}
            alt=""
            className="size-14 shrink-0 rounded-full object-cover ring-1 ring-border"
          />
        ) : (
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full border border-dashed border-border text-muted-foreground">
            <ImageUp aria-hidden className="size-5" />
          </div>
        )}

        <div className="flex flex-col gap-1.5">
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={progress !== null}
              onClick={() => input.current?.click()}
            >
              {progress !== null
                ? messages.resume.photoUploading(progress)
                : value
                  ? messages.resume.photoReplace
                  : messages.resume.photoUpload}
            </Button>

            {value ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(undefined)}
                aria-label={messages.resume.photoRemove}
                title={messages.resume.photoRemove}
              >
                <Trash2 aria-hidden className="size-4" />
              </Button>
            ) : null}
          </div>

          <p className="text-xs text-muted-foreground">{messages.resume.photoHint}</p>
        </div>
      </div>

      <input
        ref={input}
        type="file"
        accept={RESUME_PHOTO_MIME_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          // Cleared so choosing the *same* file twice fires `change` again — otherwise a failed upload
          // cannot be retried without picking a different file.
          e.target.value = "";
          if (file) void upload(file);
        }}
      />

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

/**
 * The signed upload itself. Resolves to the `secure_url` Cloudinary returns.
 *
 * `secure_url` and not `url`: the http variant would be a mixed-content image on an https CV page, which
 * browsers block outright.
 */
function postToCloudinary(
  file: File,
  sig: UploadSignature,
  onProgress: (percent: number) => void,
): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("folder", sig.folder);
  form.append("signature", sig.signature);

  return new Promise<string>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", `https://api.cloudinary.com/v1_1/${sig.cloudName}/${sig.resourceType}/upload`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };

    xhr.onload = () => {
      if (xhr.status < 200 || xhr.status >= 300) {
        reject(new Error(`Cloudinary refused the upload (${String(xhr.status)})`));
        return;
      }
      const body = JSON.parse(xhr.responseText) as { secure_url?: string };
      if (!body.secure_url) {
        reject(new Error("Cloudinary returned no secure_url"));
        return;
      }
      resolve(body.secure_url);
    };

    xhr.onerror = () => reject(new Error("Network error during upload"));
    xhr.send(form);
  });
}
