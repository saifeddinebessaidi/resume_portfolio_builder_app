"use client";

import {
  RESUME_PHOTO_MAX_BYTES,
  RESUME_PHOTO_MIME_TYPES,
  type PortfolioPhoto,
  type UploadSignature,
} from "@repo/contracts";
import { ImageUp, Star, Trash2 } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { messages } from "@/messages/fr";

/**
 * The portfolio gallery — **the missing piece of the form**.
 *
 * A portfolio for a model or a creator is mostly photographs; the form shipped without any way to add
 * one, which made every other field decoration. This is the audited repository's own upload flow
 * (`api/src/photos/photos.module.ts` + `web/lib/api.ts`), which the phase 5 audit found was the one part
 * of that codebase already built correctly: the browser asks our server for a signature, then `POST`s
 * each file **straight to Cloudinary**.
 *
 * ## Multi-file, sequential
 *
 * The original uploaded in a `for` loop rather than in parallel, and that is kept. Ten simultaneous
 * uploads on a mobile connection starve each other and the progress numbers become meaningless; one at a
 * time gives an honest "3 / 8" and a first photo that appears quickly.
 *
 * ## The cover
 *
 * Exactly one photo may be the cover — it is the hero image every one of the repo's layouts opens with.
 * Enforced here on selection rather than by a database constraint, the same way the original did it
 * (`isCover` cleared across the set, then set on one), because the gallery is a single `Jsonb` array and
 * there is no row to constrain. The first upload into an empty gallery becomes the cover automatically:
 * a portfolio whose hero slot is empty renders worse than one that guessed.
 *
 * ## What is *not* here
 *
 * `width` / `height` come back from Cloudinary and are stored, but nothing consumes them yet. They are
 * kept because a gallery that knows its aspect ratios can reserve space and avoid layout shift, and the
 * information is free at upload time and expensive to backfill.
 */
export function PortfolioPhotos({
  value,
  onChange,
}: {
  value: PortfolioPhoto[];
  onChange: (photos: PortfolioPhoto[]) => void;
}): ReactNode {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadAll = async (files: File[]): Promise<void> => {
    setError(null);

    const accepted = files.filter(
      (f) =>
        (RESUME_PHOTO_MIME_TYPES as readonly string[]).includes(f.type) &&
        f.size <= RESUME_PHOTO_MAX_BYTES,
    );

    if (accepted.length === 0) {
      setError(messages.portfolio.photosRejected);
      return;
    }

    let signature: UploadSignature;
    try {
      const response = await fetch("/api/uploads/signature");
      if (!response.ok) {
        setError(messages.resume.photoNotConfigured);
        return;
      }
      signature = (await response.json()) as UploadSignature;
    } catch {
      setError(messages.resume.photoFailed);
      return;
    }

    const added: PortfolioPhoto[] = [];
    setBusy({ done: 0, total: accepted.length });

    for (const [i, file] of accepted.entries()) {
      try {
        /**
         * One signature reused across the batch.
         *
         * Cloudinary accepts a signature for about an hour, so re-signing per file would be a round trip
         * per photo for no security gain — the folder and timestamp it authorises are identical.
         */
        const uploaded = await postToCloudinary(file, signature);
        added.push({
          assetUrl: uploaded.url,
          ...(uploaded.width ? { width: uploaded.width } : {}),
          ...(uploaded.height ? { height: uploaded.height } : {}),
          // The first photo into an empty gallery becomes the cover.
          isCover: value.length === 0 && added.length === 0,
        });
      } catch {
        setError(messages.resume.photoFailed);
      }
      setBusy({ done: i + 1, total: accepted.length });
    }

    setBusy(null);
    if (added.length > 0) onChange([...value, ...added]);
  };

  /** Exactly one cover: set it on the chosen photo and clear it everywhere else. */
  const setCover = (index: number) =>
    onChange(value.map((p, i) => ({ ...p, isCover: i === index })));

  const removeAt = (index: number) => {
    const next = value.filter((_, i) => i !== index);
    /**
     * Removing the cover promotes the first survivor.
     *
     * Otherwise the gallery is left with photos and no hero, and every layout that opens on the cover
     * silently falls back to whatever is first — which is the same outcome, decided invisibly.
     */
    if (value[index]?.isCover && next.length > 0 && !next.some((p) => p.isCover)) {
      next[0] = { ...next[0]!, isCover: true };
    }
    onChange(next);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {messages.portfolio.photos} · {value.length}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy !== null}
          onClick={() => input.current?.click()}
        >
          <ImageUp aria-hidden className="size-4" />
          {busy
            ? messages.portfolio.photosUploading(busy.done, busy.total)
            : messages.portfolio.photosAdd}
        </Button>
      </div>

      {value.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
          {messages.portfolio.photosEmpty}
        </p>
      ) : (
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
          {value.map((photo, i) => (
            <li key={`${photo.assetUrl}-${i}`} className="group relative">
              {/* A plain <img>: an arbitrary Cloudinary host, and next/image would need each one listed
                  in next.config. These are 96px thumbnails, so optimisation buys nothing. */}
              <img
                src={photo.assetUrl}
                alt=""
                className="aspect-square w-full rounded-xl object-cover ring-1 ring-border"
              />

              {photo.isCover ? (
                <span className="absolute left-1 top-1 rounded-full bg-[var(--primary)] px-1.5 py-0.5 text-[10px] text-white">
                  {messages.portfolio.cover}
                </span>
              ) : null}

              <div className="absolute inset-x-1 bottom-1 flex justify-between gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <button
                  type="button"
                  onClick={() => setCover(i)}
                  title={messages.portfolio.setCover}
                  aria-label={messages.portfolio.setCover}
                  className="rounded-full bg-black/65 p-1 text-white hover:bg-black/85"
                >
                  <Star aria-hidden className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => removeAt(i)}
                  title={messages.portfolio.removePhoto}
                  aria-label={messages.portfolio.removePhoto}
                  className="rounded-full bg-black/65 p-1 text-white hover:bg-black/85"
                >
                  <Trash2 aria-hidden className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">{messages.resume.photoHint}</p>

      <input
        ref={input}
        type="file"
        multiple
        accept={RESUME_PHOTO_MIME_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          // Cleared so re-picking the same file fires `change` again — otherwise a failed upload cannot
          // be retried without choosing something else.
          e.target.value = "";
          if (files.length > 0) void uploadAll(files);
        }}
      />

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}

interface Uploaded {
  url: string;
  width?: number;
  height?: number;
}

/** `secure_url`, not `url`: the http variant is mixed content on an https page and browsers block it. */
async function postToCloudinary(file: File, sig: UploadSignature): Promise<Uploaded> {
  const form = new FormData();
  form.append("file", file);
  form.append("api_key", sig.apiKey);
  form.append("timestamp", String(sig.timestamp));
  form.append("folder", sig.folder);
  form.append("signature", sig.signature);

  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${sig.cloudName}/${sig.resourceType}/upload`,
    {
      method: "POST",
      body: form,
    },
  );

  if (!response.ok) throw new Error(`Cloudinary refused the upload (${String(response.status)})`);

  const body = (await response.json()) as { secure_url?: string; width?: number; height?: number };
  if (!body.secure_url) throw new Error("Cloudinary returned no secure_url");

  return {
    url: body.secure_url,
    ...(body.width ? { width: body.width } : {}),
    ...(body.height ? { height: body.height } : {}),
  };
}
