"use client";

import {
  PORTFOLIO_VIDEO_MAX_BYTES,
  PORTFOLIO_VIDEO_MIME_TYPES,
  type PortfolioVideo,
} from "@repo/contracts";
import { Film, Trash2, Upload } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { fetchUploadSignature, uploadToCloudinary } from "@/lib/cloudinary-upload";
import { messages } from "@/messages/fr";

/**
 * Video upload for **Portfolio Pro** — the cover video and the reel.
 *
 * One component for both, in two modes: `single` writes one URL (the hero cover), `many` appends to the
 * reel list. They share every hard part — the signature, the size and type gate, progress reporting —
 * and splitting them would mean maintaining that twice for a difference of one array push.
 *
 * ## Progress is not optional here
 *
 * A CV photo is under 5MB and finishes before anyone looks. A showreel is up to 100MB, which on a Tunisian
 * mobile connection is minutes. Without a percentage the page is indistinguishable from frozen, so this
 * reports real bytes-sent from `XMLHttpRequest` rather than a spinner that means nothing.
 *
 * ## One at a time
 *
 * Sequential, like the photo gallery, and more important at this size: parallel 100MB uploads on one
 * connection starve each other and make every progress number meaningless.
 */
export function PortfolioVideos({
  mode,
  value,
  onChange,
}: {
  mode: "single" | "many";
  /** A single URL for the cover, or the reel. */
  value: string | PortfolioVideo[];
  onChange: (next: string | PortfolioVideo[]) => void;
}): ReactNode {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState<{ done: number; total: number; fraction: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const list = Array.isArray(value) ? value : [];
  const coverUrl = typeof value === "string" ? value : "";

  const uploadAll = async (files: File[]): Promise<void> => {
    setError(null);

    const accepted = files.filter(
      (f) =>
        (PORTFOLIO_VIDEO_MIME_TYPES as readonly string[]).includes(f.type) &&
        f.size <= PORTFOLIO_VIDEO_MAX_BYTES,
    );

    if (accepted.length === 0) {
      setError(messages.portfolio.videoRejected);
      return;
    }

    // The cover is one video; extra files picked for it are ignored rather than silently replacing it.
    const queue = mode === "single" ? accepted.slice(0, 1) : accepted;

    let signature;
    try {
      signature = await fetchUploadSignature("video");
    } catch {
      setError(messages.resume.photoNotConfigured);
      return;
    }

    const added: PortfolioVideo[] = [];
    setBusy({ done: 0, total: queue.length, fraction: 0 });

    for (const [i, file] of queue.entries()) {
      try {
        const uploaded = await uploadToCloudinary(file, signature, (fraction) => {
          setBusy({ done: i, total: queue.length, fraction });
        });

        added.push({
          assetUrl: uploaded.url,
          // The filename, minus its extension — a better default label than "Vidéo 1", and editable.
          title: file.name.replace(/\.[^.]+$/, ""),
          ...(uploaded.durationSeconds ? { durationSeconds: uploaded.durationSeconds } : {}),
        });
      } catch {
        setError(messages.resume.photoFailed);
      }
      setBusy({ done: i + 1, total: queue.length, fraction: 1 });
    }

    setBusy(null);

    if (added.length === 0) return;
    if (mode === "single") onChange(added[0]?.assetUrl ?? "");
    else onChange([...list, ...added]);
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">
          {mode === "single"
            ? messages.portfolio.coverVideo
            : `${messages.portfolio.videos} · ${String(list.length)}`}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={busy !== null}
          onClick={() => input.current?.click()}
        >
          <Upload aria-hidden className="size-4" />
          {busy
            ? messages.portfolio.videoUploading(
                busy.done + 1,
                busy.total,
                Math.round(busy.fraction * 100),
              )
            : mode === "single" && coverUrl
              ? messages.portfolio.videoReplace
              : messages.portfolio.videoAdd}
        </Button>
      </div>

      {/* A real bar, because a percentage in a label is easy to miss at this duration. */}
      {busy ? (
        <div className="h-1 w-full overflow-hidden rounded-full bg-[color-mix(in_oklab,var(--foreground)_12%,transparent)]">
          <div
            className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-150"
            style={{ width: `${String(Math.round(busy.fraction * 100))}%` }}
          />
        </div>
      ) : null}

      {mode === "single" ? (
        coverUrl ? (
          <div className="flex flex-col gap-2">
            {/* Muted and unlooped in the editor: this is a check that the right file landed, not a
                playback experience. The public hero autoplays it. */}
            <video
              src={coverUrl}
              muted
              controls
              playsInline
              className="aspect-video w-full rounded-xl bg-black object-cover ring-1 ring-border"
            />
            <button
              type="button"
              onClick={() => onChange("")}
              className="w-fit text-xs text-muted-foreground hover:text-destructive"
            >
              {messages.portfolio.videoRemove}
            </button>
          </div>
        ) : (
          <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
            {messages.portfolio.coverVideoEmpty}
          </p>
        )
      ) : list.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-6 text-center text-xs text-muted-foreground">
          {messages.portfolio.videosEmpty}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {list.map((video, i) => (
            <li
              key={`${video.assetUrl}-${String(i)}`}
              className="flex items-center gap-3 rounded-2xl border border-border p-2"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[color-mix(in_oklab,var(--foreground)_8%,transparent)]">
                <Film aria-hidden className="size-4 text-muted-foreground" />
              </span>

              <input
                value={video.title ?? ""}
                placeholder={messages.portfolio.videoTitle}
                onChange={(e) =>
                  onChange(list.map((v, j) => (j === i ? { ...v, title: e.target.value } : v)))
                }
                className="rc-input !rounded-xl !py-1.5 !text-sm"
              />

              {video.durationSeconds ? (
                <span className="shrink-0 font-mono text-xs text-muted-foreground">
                  {formatDuration(video.durationSeconds)}
                </span>
              ) : null}

              <button
                type="button"
                onClick={() => onChange(list.filter((_, j) => j !== i))}
                aria-label={messages.portfolio.videoRemove}
                title={messages.portfolio.videoRemove}
                className="shrink-0 rounded-md p-1.5 text-muted-foreground transition-colors hover:text-destructive"
              >
                <Trash2 aria-hidden className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">{messages.portfolio.videoHint}</p>

      <input
        ref={input}
        type="file"
        multiple={mode === "many"}
        accept={PORTFOLIO_VIDEO_MIME_TYPES.join(",")}
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

/** 95 → "1:35". */
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m)}:${String(s).padStart(2, "0")}`;
}
