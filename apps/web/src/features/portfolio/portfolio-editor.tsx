"use client";

import {
  portfolioCompletion,
  portfolioPayloadSchema,
  type PortfolioPayload,
  type ProjectDetail,
} from "@repo/contracts";
import { Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PortfolioForm } from "./portfolio-form";
import { ProgressBar } from "@/features/dashboard/progress-bar";
import { PublishButton } from "./publish-button";
import { messages } from "@/messages/fr";

/**
 * The portfolio editor.
 *
 * Deliberately the **same shell** as the résumé editor: autosave on blur, one payload object in state,
 * a version tracked in a ref that self-heals from a `VERSION_CONFLICT`, and a trailing save so a blur
 * arriving mid-request is queued rather than dropped. Every one of those behaviours was a bug fixed once
 * already in the résumé editor, and re-deriving them here would mean re-finding the same bugs.
 *
 * What it does **not** have is a live preview *inside* the editor. The renderer now exists — `PublicPortfolio`,
 * which is what `/p/[slug]` serves — so mounting it in a side panel is a small, obvious next step rather
 * than a port. It is left out here because the flow you asked for is create → fill → generate the link →
 * open it, and the published page is itself the preview. Worth adding when editing a live portfolio becomes
 * the common case rather than building a new one.
 */
export function PortfolioEditor({ project }: { project: ProjectDetail }): ReactNode {
  /**
   * Pro is read from the project's own category, not passed in by the route.
   *
   * The category is server-assigned and already on the response, so deriving it here means the two
   * routes (`/portfolio/[id]` and `/portfolio-pro/[id]`) mount the identical component and cannot drift —
   * and a project cannot be rendered with the wrong feature set by a route that forgot a prop.
   */
  const pro = project.categoryCode === "PORTFOLIO_PRO";

  const initial = useMemo(
    // Parsed, not cast: a payload written before a field existed gets the schema's defaults rather than
    // rendering `undefined` into an input.
    () => portfolioPayloadSchema.parse(project.data),
    [project.data],
  );

  const [draft, setDraft] = useState<PortfolioPayload>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  const [savedJson, setSavedJson] = useState(() => JSON.stringify(initial));
  const savedRef = useRef(savedJson);
  const markSaved = useCallback((body: string) => {
    savedRef.current = body;
    setSavedJson(body);
  }, []);

  const version = useRef(project.currentVersion);
  const inFlight = useRef(false);
  const queued = useRef(false);
  const latest = useRef(draft);
  useEffect(() => {
    latest.current = draft;
  }, [draft]);

  const dirty = useMemo(() => JSON.stringify(draft) !== savedJson, [draft, savedJson]);
  const completion = useMemo(() => portfolioCompletion(draft), [draft]);

  /** One PATCH, adopting the server's version on a conflict and retrying once. */
  const patchOnce = useCallback(
    async (payload: PortfolioPayload, expected: number): Promise<number | null> => {
      const response = await fetch(`/api/projects/${project.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data: payload, title: payload.name, expectedVersion: expected }),
      });

      const parsed: unknown = await response.json().catch(() => null);
      const field = (key: string): unknown =>
        parsed && typeof parsed === "object" && key in parsed
          ? (parsed as Record<string, unknown>)[key]
          : undefined;

      if (response.ok) {
        const next = Number(field("currentVersion"));
        return Number.isFinite(next) ? next : expected + 1;
      }

      if (field("code") === "VERSION_CONFLICT") {
        const meta = field("meta");
        const actual =
          meta && typeof meta === "object" && "currentVersion" in meta
            ? Number((meta as Record<string, unknown>).currentVersion)
            : NaN;
        if (Number.isFinite(actual)) {
          version.current = actual;
          return null;
        }
      }

      setError(messages.errors.generic);
      return null;
    },
    [project.id],
  );

  const flush = useCallback(async (): Promise<void> => {
    if (inFlight.current) {
      queued.current = true;
      return;
    }

    inFlight.current = true;
    setSaving(true);
    setError(null);

    try {
      do {
        queued.current = false;

        const payload = latest.current;
        const body = JSON.stringify(payload);
        if (body === savedRef.current) break;

        let next = await patchOnce(payload, version.current);
        next ??= await patchOnce(payload, version.current);
        if (next === null) break;

        markSaved(body);
        version.current = next;
        setSavedAt(new Date().toLocaleTimeString("fr-FR"));
      } while (queued.current);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }, [markSaved, patchOnce]);

  const onFormBlur = useCallback(() => {
    void flush();
  }, [flush]);

  /** A tab hidden mid-edit would otherwise lose the field still holding focus — no blur ever fires. */
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, [flush]);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
      <Card className="flex flex-col gap-6 p-6">
        {/**
         * The **project's own name**, not a section title.
         *
         * This read `sections.identity` and the form's first block is now also headed "Identité", so the
         * word appeared twice, one line apart. The card header's job is to say *which* portfolio is open.
         */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-lg">{draft.name.trim() || project.title}</h2>
          <ProgressBar percent={completion.percent} label={messages.quota.progress} />
        </div>

        {/* The autosave boundary: `onBlur` bubbles, so one handler covers every input inside. */}
        <div onBlur={onFormBlur}>
          <PortfolioForm
            projectId={project.id}
            value={draft}
            onChange={setDraft}
            saveFirst={flush}
            pro={pro}
          />
        </div>
      </Card>

      <Card className="sticky bottom-4 flex flex-col gap-3 p-5">
        <div className="flex items-center gap-2">
          <Button type="button" onClick={() => void flush()} disabled={!dirty || saving}>
            <Save aria-hidden className="size-4" />
            {saving ? messages.common.loading : messages.resume.save}
          </Button>
        </div>

        {/**
         * The link generator, beside Save.
         *
         * Publishing writes the *stored* payload, not the draft — so it belongs next to the save state
         * rather than at the top of the form: a user who presses it with unsaved edits would otherwise
         * publish a version they cannot see. Autosave on blur means that window is small, and the status
         * line below says which state the CV is in.
         */}
        <PublishButton projectId={project.id} publicUrl={project.publicUrl} />

        <p className="text-xs text-muted-foreground" aria-live="polite">
          {saving
            ? messages.resume.savingNow
            : dirty
              ? messages.resume.unsaved
              : savedAt
                ? `${messages.resume.savedAt} ${savedAt}`
                : messages.resume.autosaveHint}
        </p>

        {error ? <p className="text-xs text-destructive">{error}</p> : null}
      </Card>
    </div>
  );
}
