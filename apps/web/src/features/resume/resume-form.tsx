"use client";

import { summaryReadiness, type ResumePayload } from "@repo/contracts";
import { Sparkles } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { Bullets, CommaList, Field, ItemCard, Section, TextArea, TextInput } from "./editor-parts";
import { Button } from "@/components/ui/button";
import { generateSummary } from "./summary-generator";
import { messages } from "@/messages/fr";

/**
 * The full resume form — **every section the builder repository's editor had**: profile, experience,
 * skills, projects, languages, education, with reordering and per-entry bullets.
 *
 * Ported behaviour, changed design. The generic array helpers below (`add` / `update` / `remove` /
 * `move`) are the builder's `addItem` / `upItem` / `rmItem` / `moveItem`, kept because one set of
 * helpers over five sections is what stops this file becoming five near-identical blocks.
 *
 * It is a **controlled component**: it owns no state and never saves. The parent holds the draft and
 * decides when to PATCH, which is what keeps one explicit save equal to one revision. That inversion is
 * the whole difference from the original, where every section wrote itself on a debounce.
 */
type ArrayKey = "experiences" | "skills" | "projects" | "languages" | "education";

export function ResumeForm({
  value,
  onChange,
  projectId,
  onFlush,
  allowRegenerate = false,
}: {
  value: ResumePayload;
  onChange: (next: ResumePayload) => void;
  /** Needed only by the Profil generator, which posts to `/api/projects/:id/resume-summary`. */
  projectId: string;
  /** The editor's autosave flush. Awaited before generating — see `SummarySection`. */
  onFlush: () => Promise<void>;
  /** Testing escape hatch: lets the Profil be generated more than once. Off by default. */
  allowRegenerate?: boolean;
}): ReactNode {
  const set = <K extends keyof ResumePayload>(key: K, v: ResumePayload[K]) =>
    onChange({ ...value, [key]: v });

  function add<K extends ArrayKey>(key: K, blank: ResumePayload[K][number]): void {
    onChange({ ...value, [key]: [...value[key], blank] });
  }

  function update<K extends ArrayKey>(
    key: K,
    i: number,
    patch: Partial<ResumePayload[K][number]>,
  ): void {
    onChange({
      ...value,
      [key]: value[key].map((it, j) => (j === i ? { ...it, ...patch } : it)),
    });
  }

  function remove<K extends ArrayKey>(key: K, i: number): void {
    onChange({ ...value, [key]: value[key].filter((_, j) => j !== i) });
  }

  function move<K extends ArrayKey>(key: K, i: number, dir: -1 | 1): void {
    const next = [...value[key]];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    const a = next[i];
    const b = next[j];
    if (a === undefined || b === undefined) return;
    next[i] = b;
    next[j] = a;
    onChange({ ...value, [key]: next });
  }

  const arrows = <K extends ArrayKey>(key: K, i: number) => ({
    onUp: () => move(key, i, -1),
    onDown: () => move(key, i, 1),
    onRemove: () => remove(key, i),
  });

  return (
    <div className="flex flex-col gap-8">
      {/* ---------------- Profile ---------------- */}
      <Section title={messages.resume.sections.profile}>
        <Field label={messages.resume.name}>
          <TextInput value={value.name} onChange={(v) => set("name", v)} />
        </Field>
        <Field label={messages.resume.fullName}>
          <TextInput value={value.fullName} onChange={(v) => set("fullName", v)} />
        </Field>
        <Field label={messages.resume.jobTitle}>
          <TextInput value={value.title} onChange={(v) => set("title", v)} />
        </Field>

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={messages.account.email}>
            <TextInput value={value.email} onChange={(v) => set("email", v)} />
          </Field>
          <Field label={messages.resume.phone}>
            <TextInput value={value.phone ?? ""} onChange={(v) => set("phone", v)} />
          </Field>
          <Field label={messages.resume.location}>
            <TextInput value={value.location ?? ""} onChange={(v) => set("location", v)} />
          </Field>
          <Field label={messages.resume.fields.website}>
            <TextInput value={value.website ?? ""} onChange={(v) => set("website", v)} />
          </Field>
          <Field label={messages.resume.fields.github}>
            <TextInput value={value.github ?? ""} onChange={(v) => set("github", v)} />
          </Field>
          <Field label={messages.resume.fields.linkedin}>
            <TextInput value={value.linkedin ?? ""} onChange={(v) => set("linkedin", v)} />
          </Field>
        </div>
      </Section>

      {/* ---------------- Experience ---------------- */}
      <Section
        title={messages.resume.sections.experience}
        onAdd={() => add("experiences", { title: "", bullets: [] })}
      >
        {value.experiences.map((e, i) => (
          <ItemCard key={i} {...arrows("experiences", i)}>
            <Field label={messages.resume.jobTitle}>
              <TextInput value={e.title} onChange={(v) => update("experiences", i, { title: v })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={messages.resume.fields.company}>
                <TextInput
                  value={e.company ?? ""}
                  onChange={(v) => update("experiences", i, { company: v })}
                />
              </Field>
              <Field label={messages.resume.fields.companyNote}>
                <TextInput
                  value={e.companyNote ?? ""}
                  onChange={(v) => update("experiences", i, { companyNote: v })}
                />
              </Field>
              <Field label={messages.resume.location}>
                <TextInput
                  value={e.location ?? ""}
                  onChange={(v) => update("experiences", i, { location: v })}
                />
              </Field>
              <Field label={messages.resume.fields.start}>
                <TextInput
                  value={e.startDate ?? ""}
                  onChange={(v) => update("experiences", i, { startDate: v })}
                />
              </Field>
              {/* An empty end date is meaningful: the template renders "Present". */}
              <Field label={messages.resume.fields.end}>
                <TextInput
                  value={e.endDate ?? ""}
                  onChange={(v) => update("experiences", i, { endDate: v })}
                />
              </Field>
            </div>
            <Bullets
              value={e.bullets}
              onChange={(bullets) => update("experiences", i, { bullets })}
            />
          </ItemCard>
        ))}
      </Section>

      {/* ---------------- Skills ---------------- */}
      <Section
        title={messages.resume.sections.skills}
        onAdd={() => add("skills", { heading: "", items: [] })}
      >
        {value.skills.map((s, i) => (
          <ItemCard key={i} {...arrows("skills", i)}>
            <Field label={messages.resume.fields.heading}>
              <TextInput value={s.heading} onChange={(v) => update("skills", i, { heading: v })} />
            </Field>
            <CommaList
              label={messages.resume.fields.items}
              value={s.items}
              onChange={(items) => update("skills", i, { items })}
            />
          </ItemCard>
        ))}
      </Section>

      {/* ---------------- Projects ---------------- */}
      <Section
        title={messages.resume.sections.projects}
        onAdd={() => add("projects", { title: "", bullets: [] })}
      >
        {value.projects.map((p, i) => (
          <ItemCard key={i} {...arrows("projects", i)}>
            <Field label={messages.resume.jobTitle}>
              <TextInput value={p.title} onChange={(v) => update("projects", i, { title: v })} />
            </Field>
            <Field label={messages.resume.fields.technologies}>
              <TextInput
                value={p.technologies ?? ""}
                onChange={(v) => update("projects", i, { technologies: v })}
              />
            </Field>
            <Field label={messages.resume.fields.description}>
              <TextArea
                value={p.description ?? ""}
                onChange={(v) => update("projects", i, { description: v })}
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={messages.resume.fields.github}>
                <TextInput
                  value={p.githubUrl ?? ""}
                  onChange={(v) => update("projects", i, { githubUrl: v })}
                />
              </Field>
              <Field label={messages.resume.fields.demo}>
                <TextInput
                  value={p.demoUrl ?? ""}
                  onChange={(v) => update("projects", i, { demoUrl: v })}
                />
              </Field>
            </div>
            <Bullets value={p.bullets} onChange={(bullets) => update("projects", i, { bullets })} />
          </ItemCard>
        ))}
      </Section>

      {/* ---------------- Education ---------------- */}
      <Section
        title={messages.resume.sections.education}
        onAdd={() => add("education", { degree: "" })}
      >
        {value.education.map((e, i) => (
          <ItemCard key={i} {...arrows("education", i)}>
            <Field label={messages.resume.fields.degree}>
              <TextInput value={e.degree} onChange={(v) => update("education", i, { degree: v })} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={messages.resume.fields.institution}>
                <TextInput
                  value={e.institution ?? ""}
                  onChange={(v) => update("education", i, { institution: v })}
                />
              </Field>
              <Field label={messages.resume.fields.detail}>
                <TextInput
                  value={e.detail ?? ""}
                  onChange={(v) => update("education", i, { detail: v })}
                />
              </Field>
              <Field label={messages.resume.fields.start}>
                <TextInput
                  value={e.startDate ?? ""}
                  onChange={(v) => update("education", i, { startDate: v })}
                />
              </Field>
              <Field label={messages.resume.fields.end}>
                <TextInput
                  value={e.endDate ?? ""}
                  onChange={(v) => update("education", i, { endDate: v })}
                />
              </Field>
            </div>
          </ItemCard>
        ))}
      </Section>

      {/* ---------------- Languages ---------------- */}
      <Section
        title={messages.resume.sections.languages}
        onAdd={() => add("languages", { name: "" })}
      >
        {value.languages.map((l, i) => (
          <ItemCard key={i} {...arrows("languages", i)}>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={messages.resume.fields.languageName}>
                <TextInput value={l.name} onChange={(v) => update("languages", i, { name: v })} />
              </Field>
              <Field label={messages.resume.fields.level}>
                <TextInput
                  value={l.level ?? ""}
                  onChange={(v) => update("languages", i, { level: v })}
                />
              </Field>
            </div>
          </ItemCard>
        ))}
      </Section>

      {/**
       * ---------------- Summary, last ----------------
       *
       * Moved out of Profile and to the bottom, by your call — and the order now matches how the
       * generator works. A summary is a *conclusion* drawn from the sections above it, so asking for it
       * first meant asking the user to summarise a CV they had not written yet, and left the Generate
       * button with nothing to read.
       *
       * It stays at the **top of the printed sheet**: the template's block order is independent of the
       * form's, so the reader still opens on the summary while the author writes it last.
       */}
      <SummarySection
        value={value}
        projectId={projectId}
        onFlush={onFlush}
        allowRegenerate={allowRegenerate}
        onChangeSummary={(summary) => set("summary", summary)}
        onGenerate={(summary, spend) =>
          // Both fields in one update: two sequential `set` calls would each spread the *stale* `value`,
          // and the second would discard the first.
          //
          // `spend` is false when the text came from the local fallback rather than the model — see the
          // note on `SummarySection`. The summary lands either way; only the one-shot flag differs.
          onChange({ ...value, summary, summaryGenerated: spend })
        }
      />
    </div>
  );
}

/**
 * The summary field and its generator.
 *
 * Its own component because it is the one section holding local state — the pending flag and the
 * fallback notice. Keeping that out of `ResumeForm` means a keystroke in any other field does not
 * re-render around it.
 *
 * ## The Profil is written by the model, on the server
 *
 * It used to be composed here, in the browser, by a string template — which is why it read as a list of
 * facts the CV already showed underneath it. It now posts to `/api/projects/:id/resume-summary`, which
 * runs the same LLM pipeline the portfolio generator uses. `summary-generator.ts` stays as the offline
 * fallback and nothing else.
 *
 * ## Why the autosave flush is awaited first
 *
 * The endpoint generates from the payload the server has **stored**, so anything typed and not yet
 * saved is invisible to it. Pressing the button blurs the field, which starts an autosave — so without
 * awaiting it the model would be handed the *previous* version: type an experience, press Générer, get
 * a Profil written as if that experience did not exist. The portfolio button hit exactly this bug and
 * carries the same `await`.
 */
function SummarySection({
  value,
  projectId,
  onFlush,
  allowRegenerate,
  onChangeSummary,
  onGenerate,
}: {
  value: ResumePayload;
  projectId: string;
  onFlush: () => Promise<void>;
  allowRegenerate: boolean;
  onChangeSummary: (summary: string) => void;
  /** `spend` marks whether this draft consumes the CV's single generation. */
  onGenerate: (summary: string, spend: boolean) => void;
}): ReactNode {
  const readiness = useMemo(() => summaryReadiness(value), [value]);
  const [pending, setPending] = useState(false);
  const [fellBack, setFellBack] = useState(false);

  /**
   * **One generation per CV.** `summaryGenerated` lives in the payload, so the button stays spent across
   * reloads and across devices — component state would forget on refresh, which is not "once".
   *
   * The text remains fully editable afterwards. What is spent is the *generator*, not the field: the
   * intent is to stop someone re-rolling the same paragraph instead of improving it.
   *
   * Worth being explicit that this is a UX rule and not enforcement: the payload is client-writable, so
   * the server does not know a generation has been spent. If it ever needs to be enforced it belongs
   * next to the export counter — see the note on `summaryGenerated` in the payload schema.
   */
  const alreadyGenerated = value.summaryGenerated;

  /**
   * `allowRegenerate` lifts the once-per-CV rule for a deployment being tested — iterating on the
   * generator means running it repeatedly against the same CV, and the flag that stops that lives in the
   * payload, so it survives reloads and cannot be cleared from the UI.
   *
   * It relaxes **only** that clause. Readiness still gates, and a request in flight still gates.
   */
  const spent = alreadyGenerated && !allowRegenerate;
  const disabled = !readiness.ready || spent || pending;

  const generate = async (): Promise<void> => {
    if (disabled) return;

    /**
     * Confirm before overwriting, and only when there is something to overwrite.
     *
     * Reachable solely with `allowRegenerate` on — the button is disabled after one generation
     * otherwise. Without it a second press would silently discard a paragraph the user may have spent
     * ten minutes editing, which is exactly the accident the portfolio button's confirm prevents.
     */
    if (alreadyGenerated && (value.summary ?? "").trim().length > 0) {
      if (!window.confirm(messages.resume.generateConfirm)) return;
    }

    setPending(true);
    setFellBack(false);

    try {
      // See the note above: the server reads the stored payload, not this component's `value`.
      await onFlush();

      const response = await fetch(`/api/projects/${projectId}/resume-summary`, { method: "POST" });
      if (!response.ok) throw new Error("generation failed");

      const { summary } = (await response.json()) as { summary: string };
      if (summary.trim().length === 0) throw new Error("empty generation");

      onGenerate(summary, true);
    } catch {
      /**
       * **Any failure falls back to the local composer, and does not spend the one generation.**
       *
       * The failures worth naming are "the server has no `AI_API_KEY`" and "the provider timed out";
       * both arrive here indistinguishably, and both are the server's problem rather than the user's.
       * Burning their single shot on a paragraph the server could not write would be charging them for
       * our outage — leaving the flag clear means pressing again once generation works gets the real
       * thing.
       *
       * The deterministic draft is still worth showing: it is a weaker paragraph, but it is theirs, it
       * is accurate, and it beats a blank field with an error over it.
       */
      const draft = generateSummary(value);
      if (draft) onGenerate(draft, false);
      setFellBack(true);
    } finally {
      setPending(false);
    }
  };

  const hint = (): string => {
    if (pending) return messages.resume.generating;
    if (fellBack) return messages.resume.generateFallbackNote;
    // Says *why* the button is still live after a generation, so the relaxed rule is visible rather
    // than looking like the once-per-CV limit silently failing.
    if (alreadyGenerated && allowRegenerate) return messages.resume.regenerateEnabled;
    if (alreadyGenerated) return messages.resume.generatedNote;
    if (readiness.missingTitle) return messages.resume.generateNeedsTitle;
    if (!readiness.ready) {
      return messages.resume.generateNeedsSections(
        readiness.filled,
        readiness.required,
        readiness.missing.map((m) => messages.resume.generateFields[m]),
      );
    }
    return messages.resume.generateHint;
  };

  return (
    <Section title={messages.resume.sections.summary}>
      <Field label={messages.resume.summary}>
        <TextArea
          value={value.summary ?? ""}
          rows={5}
          placeholder={messages.resume.summaryPlaceholder}
          onChange={onChangeSummary}
        />
      </Field>

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => void generate()}
          // Disabled rather than hidden, in every case: a button that vanishes teaches nothing, and the
          // hint beside it says which sections are still needed, that a draft is being written, or that
          // the one shot is spent.
          disabled={disabled}
        >
          <Sparkles aria-hidden className="size-4" />
          {pending ? messages.resume.generating : messages.resume.generate}
        </Button>

        <p className="text-xs text-muted-foreground" aria-live="polite">
          {hint()}
        </p>
      </div>
    </Section>
  );
}
