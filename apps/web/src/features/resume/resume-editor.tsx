"use client";

import {
  type ProjectDetail,
  type ResumePayload,
  resumeCompletion,
  resumePayloadSchema,
  templateHasPortrait,
} from "@repo/contracts";
import { Save } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CompletionDetail } from "./completion-detail";
import { ExportButton } from "./export-button";
import { PhotoField } from "./photo-field";
import { ProgressBar } from "@/features/dashboard/progress-bar";
import { TemplatePicker } from "./template-picker";
import { hasCleanCopy } from "./clean-copy";
import { isUntouchedResume } from "./untouched";
import { ResumeForm } from "./resume-form";
import { ResumeSheet } from "./resume-sheet";
import { messages } from "@/messages/fr";

/**
 * The resume editor.
 *
 * ## Autosave, on blur
 *
 * Every edit lives in React state, and leaving a field commits it: a single delegated `onBlur` on the
 * form container fires when focus leaves any input inside it, and saves **if the payload actually
 * changed**. Tabbing through fields without typing sends nothing, so the cost is one save per edited
 * field rather than one per focus change.
 *
 * This was impossible until the revision cap was lifted (ADR-0013): `RESUME_1M` granted one revision per
 * CV, so a single blur would have spent a paying customer's entire allowance. Now that creating and
 * editing are free and only *delivery* is paid (ADR-0012), charging for edits punished exactly the
 * behaviour the funnel depends on — someone refining a CV they have not yet bought.
 *
 * The explicit **Save** button stays. It is no longer the only way work is persisted, but it is the way
 * to commit the field you are *currently typing in* without clicking away first, and it is the affordance
 * that tells a user their work is safe.
 *
 * ## The two things autosave has to get right, and got wrong first
 *
 * Both were reported from real use, and both had the same root: treating the version number as
 * bookkeeping that could not drift, and treating a concurrent blur as something to discard.
 *
 * **A stale `expectedVersion` must self-heal, not lock the editor.** Every save advances the version, so
 * a single dropped save or an unreadable response left the client permanently behind the server — and
 * then *every* blur failed with "Ce projet a été modifié ailleurs. Rechargez la page", with no other tab
 * open. `patchOnce` now adopts the version the conflict reports and retries once, silently.
 *
 * **A blur during a save must be kept, not dropped.** The first version returned early if a request was
 * in flight, which silently lost the edit — tabbing quickly between two fields persisted only the first.
 * `flush` sets a flag instead and re-reads the draft when the request lands, so bursts collapse into one
 * write and the last thing typed always arrives.
 */
export function ResumeEditor({ project }: { project: ProjectDetail }): ReactNode {
  const initial = useMemo(
    // The stored payload is parsed rather than cast: an older `schemaVersion` may be missing fields
    // added since, and the schema's defaults fill them in instead of the editor rendering `undefined`.
    () => resumePayloadSchema.parse(project.data),
    [project.data],
  );

  const [draft, setDraft] = useState<ResumePayload>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);

  /**
   * What the server currently holds, as JSON.
   *
   * `dirty` is measured against **this**, not against the `initial` prop: after an autosave the prop is
   * still the payload this tab was loaded with, so comparing to it would report the CV as permanently
   * unsaved and re-send an identical body on every subsequent blur.
   *
   * Held as **state and a ref**, deliberately, because the two readers need different things. Render
   * needs state, or `dirty` never recomputes and the Save button stays enabled after a successful save.
   * The blur handler needs the ref: it must see the newest value *synchronously*, and a state value
   * captured by a handler created in the same render is one tick behind — which is exactly the window a
   * duplicate save slips through.
   */
  const [savedJson, setSavedJson] = useState(() => JSON.stringify(initial));
  const savedRef = useRef(savedJson);

  const markSaved = useCallback((body: string) => {
    savedRef.current = body;
    setSavedJson(body);
  }, []);

  /** The version the server holds. Advances on every save, so `expectedVersion` cannot go stale. */
  const version = useRef(project.currentVersion);
  const inFlight = useRef(false);
  /** The latest draft, for the handler to read without being re-created on every keystroke. */
  const latest = useRef(draft);
  useEffect(() => {
    latest.current = draft;
  }, [draft]);

  const dirty = useMemo(() => JSON.stringify(draft) !== savedJson, [draft, savedJson]);

  const clean = hasCleanCopy(project);

  /**
   * **Completion, computed live from the draft — not from the server's copy.**
   *
   * The editor is the one place the number can move while the user types, and it must: a progress bar
   * that only advances on save would sit still through the very work it is measuring. `resumeCompletion`
   * is the same function the API runs for the dashboard, so the two always agree once a save lands.
   *
   * This replaced a save-count badge, which in turn replaced "1 sur 1 restant" — an allowance the server
   * stopped enforcing in ADR-0013. Progress is the number a user filling in a CV actually wants.
   */
  const completion = useMemo(() => resumeCompletion(draft), [draft]);

  /**
   * **Placeholders are for an empty sheet only.**
   *
   * They answer "what does this template look like?", and once there is a CV on the page that question is
   * already answered by the CV. Recomputed per keystroke on purpose: the bars have to disappear on the
   * first character typed, not on the next save, or the preview spends the whole session disagreeing with
   * the form beside it.
   */
  const untouched = useMemo(() => isUntouchedResume(draft), [draft]);

  /** Set when a blur arrives while a save is in flight, so the loop below comes back for it. */
  const queued = useRef(false);

  /**
   * One PATCH, with **automatic recovery from a stale version**.
   *
   * Returns the new version on success, or `null` when the caller should stop.
   *
   * ## Why the retry exists
   *
   * `expectedVersion` is client bookkeeping, and autosave writes constantly — so a single save that was
   * dropped, or a response that did not carry the new number, left `version.current` behind the server
   * forever. Every subsequent blur then failed, and the user saw "Ce projet a été modifié ailleurs.
   * Rechargez la page" over and over with no other tab open. That message was true of the data and
   * useless to the person reading it.
   *
   * The API already tells us the truth: `VERSION_CONFLICT` carries `meta.currentVersion`. So a conflict
   * adopts that number and re-sends the user's current draft **once**, silently. That is safe precisely
   * because the payload being written is the whole document as it stands in front of them — not a patch
   * that could interleave with someone else's.
   *
   * A second conflict is a genuinely concurrent editor and stops, because retrying forever between two
   * open tabs is how you get a write loop.
   */
  const patchOnce = useCallback(
    async (payload: ResumePayload, expected: number): Promise<number | null> => {
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

      // Anything else — a validation failure, a lost network, a 500. Deliberately **not** the API's own
      // `detail` for a conflict: "rechargez la page" is not something we want to say to someone who is
      // simply typing, and by here we have already tried the one thing that fixes it.
      setError(messages.errors.generic);
      return null;
    },
    [project.id],
  );

  /**
   * Persist whatever the draft currently is, coalescing bursts.
   *
   * The previous version **dropped** a save that arrived while another was in flight, which is the other
   * half of the reported bug: tabbing quickly between fields silently lost the second edit. Now a blur
   * during a save sets `queued`, and the loop re-reads `latest` when the request finishes — so the last
   * thing the user typed always reaches the server, and rapid blurs collapse into one write rather than
   * a queue of them.
   */
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
        // Nothing changed since the last successful save — a focus change without an edit. Sending it
        // would write a version identical to the current one.
        if (body === savedRef.current) break;

        let next = await patchOnce(payload, version.current);
        // One retry, against the version the conflict just told us about.
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

  /**
   * One handler for the whole form. React's `onBlur` follows `focusout` and therefore bubbles, so this
   * catches focus leaving any field inside — no per-input wiring, and a section added later is covered
   * without anyone remembering to opt it in.
   *
   * Deliberately **not** debounced-on-keystroke, which is what the source builder did: a save per
   * keypress produces a version row per keypress, and `ProjectVersion.data` is up to 1MB of `Jsonb`.
   * Blur is the natural commit point — the user has finished with the field.
   */
  const onFormBlur = useCallback(() => {
    void flush();
  }, [flush]);

  /**
   * A tab closed mid-edit would otherwise lose the field still holding focus, because no blur ever
   * fires. `visibilitychange` is the reliable signal — `beforeunload` is unreliable for async work and
   * browsers ignore it on mobile.
   */
  useEffect(() => {
    const onHidden = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", onHidden);
    return () => document.removeEventListener("visibilitychange", onHidden);
  }, [flush]);

  return (
    /**
     * **The form column is the one that scrolls; the preview is pinned beside it.**
     *
     * `items-start` is what makes that possible at all: a grid item stretches to the row's height by
     * default, and a `sticky` element inside a box that is already as tall as its tallest sibling has no
     * room left to travel — it simply never sticks. Aligning the items to the top gives the preview a box
     * of its own height, which `lg:sticky` can then pin.
     *
     * The form's track went from 420px to 560px on your ask. That comes straight out of the preview's
     * track — the shell is `max-w-7xl` (1200px of content at `px-10`), so the two columns share a fixed
     * budget and the sheet's zoom below is tuned to whatever is left.
     */
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,560px)_minmax(0,1fr)]">
      {/* ---------------- form ---------------- */}
      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-6 p-6">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-lg">{messages.resume.identity}</h2>
            <ProgressBar percent={completion.percent} label={messages.quota.progress} />
          </div>

          {/**
           * **Document language**, above the template switch — the language the CV is printed in, not
           * the dashboard's. Sits here because it is the same kind of setting as `layout`: a per-CV
           * choice that changes the sheet on the right immediately.
           *
           * These are buttons rather than a `<select>` so that both options are visible at a glance;
           * with exactly two choices a dropdown hides half the answer behind a click.
           */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-medium text-muted-foreground">
              {messages.resume.language}
            </span>
            <div className="flex gap-2">
              {(["fr", "en"] as const).map((lang) => (
                <Button
                  key={lang}
                  type="button"
                  variant={draft.language === lang ? "primary" : "ghost"}
                  size="sm"
                  aria-pressed={draft.language === lang}
                  onClick={() => setDraft((d) => ({ ...d, language: lang }))}
                >
                  {lang === "fr" ? messages.resume.languageFr : messages.resume.languageEn}
                </Button>
              ))}
            </div>
          </div>

          {/* The percentage, broken down — so "why 60%?" is answerable without asking. */}
          <CompletionDetail completion={completion} />

          {/**
           * The template picker — convention tab, then the designs available for it.
           *
           * It replaced a two-option "Modèle" switch whose second option rendered identically to the
           * first, because no second renderer existed. Selecting here updates the payload, so the sheet
           * on the right and the PDF both change immediately; nothing is applied at download time.
           */}
          <TemplatePicker
            value={draft.template}
            onChange={(template) => setDraft((d) => ({ ...d, template }))}
          />

          {/**
           * The portrait, **only when the chosen template is a European one**.
           *
           * Driven off the registry rather than a hard-coded list of ids, so a template added later
           * declares its own convention and this needs no edit. Hidden rather than disabled: a North
           * American résumé should not carry a photo at all, so offering the control greyed out would
           * suggest it is merely unavailable.
           */}
          {/**
           * Gated on **the template**, not the continent.
           *
           * `styleOfTemplate(...) === EUROPE` was a proxy, and it was wrong in both directions: it
           * offered a photo for any European template whether or not the design had a slot, and hid it
           * from a non-European one that did. `templateHasPortrait` asks the question that actually
           * decides whether a photo can be rendered — and it is the same registry flag the renderers
           * honour, so the field and the sheet cannot disagree.
           */}
          {templateHasPortrait(draft.template) ? (
            <PhotoField
              value={draft.photoUrl}
              onChange={(photoUrl) =>
                setDraft((d) => {
                  // `exactOptionalPropertyTypes`: removing the key is not the same as setting it to
                  // `undefined`, and the payload schema treats the field as absent-or-string.
                  if (photoUrl === undefined) {
                    const { photoUrl: _dropped, ...rest } = d;
                    return rest;
                  }
                  return { ...d, photoUrl };
                })
              }
            />
          ) : null}

          {/**
           * The autosave boundary. `onBlur` bubbles, so this one handler covers every input the form
           * renders now or later. It wraps only the fields — the language and layout buttons above sit
           * outside it, because they already commit through their own `setDraft` and a blur on a toggle
           * the user merely tabbed past should not trigger a write.
           */}
          <div onBlur={onFormBlur}>
            {/* Every section the builder's editor had. Controlled: it owns no state and never saves. */}
            <ResumeForm value={draft} onChange={setDraft} />
          </div>
        </Card>

        {/* ---------------- save bar ---------------- */}
        <Card className="sticky bottom-4 flex flex-col gap-3 p-5">
          {/**
           * Save only. The discard button is gone by your call — and it would now be actively
           * misleading: with autosave on, "Annuler les modifications" could only revert the draft to the
           * payload this tab was *loaded* with, which every autosave since has already superseded on the
           * server. A real undo needs version history (`GET /projects/:id/versions` already stores it),
           * not a local reset that silently disagrees with the database.
           */}
          <div className="flex items-center gap-2">
            <Button type="button" onClick={() => void flush()} disabled={!dirty || saving}>
              <Save aria-hidden className="size-4" />
              {saving ? messages.common.loading : messages.resume.save}
            </Button>
          </div>

          <div className="flex items-start justify-between gap-3 border-t border-border pt-3">
            <p className="max-w-[22ch] text-xs text-muted-foreground">
              {messages.resume.printHint}
            </p>
            <ExportButton
              projectId={project.id}
              exportCount={project.exportCount}
              exportLimit={project.exportLimit}
            />
          </div>

          {/* Saving > unsaved > saved-at > the autosave explanation, in that order: the most
              transient state is the most useful one to show. */}
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

      {/* ---------------- live preview ---------------- */}
      {/**
       * Pinned from `lg` up, and **scrollable in its own right**.
       *
       * `top-20` clears the sticky navbar (`top-0`, `py-4`) rather than sliding under it. The height cap
       * is what stops "pinned" from meaning "the bottom of the CV is unreachable": an A4 sheet is taller
       * than any laptop viewport even zoomed out, so the column keeps its own scrollbar. The page scroll
       * therefore moves the form only, and the sheet is scrolled deliberately when you want to look
       * further down it.
       *
       * Below `lg` the grid is one column and none of this applies — a preview pinned above a form on a
       * phone would eat the screen the form needs.
       */}
      <div className="flex flex-col gap-3 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)]">
        {!clean ? (
          <p className="rounded-2xl border border-[color-mix(in_oklab,var(--accent)_40%,transparent)] bg-[color-mix(in_oklab,var(--accent)_10%,transparent)] px-4 py-2.5 text-xs">
            {messages.resume.watermarkNotice}
          </p>
        ) : null}

        {/* `min-h-0` so this flex child may shrink below its content height — without it the cap above
            is ignored and the column grows to the full sheet, taking the page scroll back with it. */}
        <div className="min-h-0 flex-1 overflow-auto">
          {/**
           * **`zoom`, not `transform: scale`.**
           *
           * `scale` is paint-only: the sheet kept its full 210 × 297mm *layout* box whatever the factor,
           * so a shrunken preview still reserved a full-size hole — dead space below it and a horizontal
           * scrollbar beside it. That was survivable while the preview owned the wider track; with the
           * form at 560px it is not. `zoom` scales the layout box too, so the column is exactly as big as
           * the picture in it, at any sheet height.
           *
           * The factors are tuned to what each breakpoint actually leaves: ~616px of track at `lg`
           * against a 210mm (≈794px) sheet, hence 0.74.
           */}
          <div className="mx-auto w-fit [zoom:0.4] sm:[zoom:0.62] lg:[zoom:0.74]">
            {/* Watermarked until a download has been paid for on this project. The flag comes from the
                server-loaded project, not from client state. */}
            {/**
             * `placeholders` is on **here only, and only while the CV is empty**.
             *
             * A blank CV would otherwise render as a blank page, which tells nobody anything about the
             * template they just picked — so an untouched sheet still shows its layout in faint labels and
             * grey bars. As soon as anything is written they all go, together: the preview then holds the
             * user's data and nothing else, and half-filled sections read as progress rather than as a
             * document full of holes. See `isUntouchedResume`.
             *
             * The print route never passes the flag at all, so a downloaded PDF cannot contain "Votre
             * nom" or a grey bar under any circumstances — see the note on `ResumeSheet`.
             */}
            <ResumeSheet data={draft} watermark={!clean} placeholders={untouched} />
          </div>
        </div>
      </div>
    </div>
  );
}
