"use client";

import {
  RESUME_PHOTO_MAX_BYTES,
  RESUME_PHOTO_MIME_TYPES,
  type UploadSignature,
} from "@repo/contracts";
import { ImageUp, Trash2 } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { uploadToCloudinary } from "@/lib/cloudinary-upload";
import { messages } from "@/messages/fr";

const MAX_IMAGES = 12;

/**
 * A project's own images — replaces the free-text "URL de l'image" field.
 *
 * Same signed-upload flow as `PortfolioPhotos`: one signature from our server, then each file goes
 * straight to Cloudinary, one at a time so the "3 / 8" counter stays honest on a mobile connection.
 * The first image is the one the project card shows.
 */
export function WorkImages({
  value,
  onChange,
}: {
  value: string[];
  onChange: (urls: string[]) => void;
}): ReactNode {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const uploadAll = async (files: File[]): Promise<void> => {
    setError(null);

    const accepted = files
      .filter(
        (f) =>
          (RESUME_PHOTO_MIME_TYPES as readonly string[]).includes(f.type) &&
          f.size <= RESUME_PHOTO_MAX_BYTES,
      )
      .slice(0, MAX_IMAGES - value.length);

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

    const added: string[] = [];
    setBusy({ done: 0, total: accepted.length });

    for (const [i, file] of accepted.entries()) {
      try {
        added.push((await uploadToCloudinary(file, signature)).url);
      } catch {
        setError(messages.resume.photoFailed);
      }
      setBusy({ done: i + 1, total: accepted.length });
    }

    setBusy(null);
    if (added.length > 0) onChange([...value, ...added]);
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {messages.portfolio.workImages} · {value.length}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy !== null || value.length >= MAX_IMAGES}
          onClick={() => input.current?.click()}
        >
          <ImageUp aria-hidden className="size-4" />
          {busy
            ? messages.portfolio.photosUploading(busy.done, busy.total)
            : messages.portfolio.photosAdd}
        </Button>
      </div>

      {value.length > 0 ? (
        <ul className="grid grid-cols-4 gap-2 sm:grid-cols-6">
          {value.map((url, i) => (
            <li key={`${url}-${i}`} className="group relative">
              <img
                src={url}
                alt=""
                className="aspect-square w-full rounded-xl object-cover ring-1 ring-border"
              />
              <button
                type="button"
                onClick={() => onChange(value.filter((_, j) => j !== i))}
                title={messages.portfolio.removePhoto}
                aria-label={messages.portfolio.removePhoto}
                className="absolute bottom-1 right-1 rounded-full bg-black/65 p-1 text-white opacity-0 transition-opacity hover:bg-black/85 focus:opacity-100 group-hover:opacity-100"
              >
                <Trash2 aria-hidden className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <input
        ref={input}
        type="file"
        multiple
        accept={RESUME_PHOTO_MIME_TYPES.join(",")}
        className="hidden"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          // Cleared so re-picking the same file fires `change` again.
          e.target.value = "";
          if (files.length > 0) void uploadAll(files);
        }}
      />

      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
