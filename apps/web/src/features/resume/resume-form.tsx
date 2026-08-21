"use client";

import { type ResumePayload } from "@repo/contracts";
import { Sparkles } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { Bullets, CommaList, Field, ItemCard, Section, TextArea, TextInput } from "./editor-parts";
import { Button } from "@/components/ui/button";
import { generateSummary, summaryReadiness } from "./summary-generator";
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
}: {
  value: ResumePayload;
  onChange: (next: ResumePayload) => void;
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
        onChangeSummary={(summary) => set("summary", summary)}
        onGenerate={(summary) =>
          // Both fields in one update: two sequential `set` calls would each spread the *stale* `value`,
          // and the second would discard the first.
          onChange({ ...value, summary, summaryGenerated: true })
        }
      />
    </div>
  );
}

/**
 * The summary field and its generator.
 *
 * Its own component because it is the one section holding local state — `justGenerated`, for the
 * confirmation line. Keeping that out of `ResumeForm` means a keystroke in any other field does not
 * re-render around it.
 */
function SummarySection({
  value,
  onChangeSummary,
  onGenerate,
}: {
  value: ResumePayload;
  onChangeSummary: (summary: string) => void;
  onGenerate: (summary: string) => void;
}): ReactNode {
  const readiness = useMemo(() => summaryReadiness(value), [value]);

  /**
   * **One generation per CV.** `summaryGenerated` lives in the payload, so the button stays spent across
   * reloads and across devices — component state would forget on refresh, which is not "once".
   *
   * The text remains fully editable afterwards. What is spent is the *generator*, not the field: the
   * intent is to stop someone re-rolling the same paragraph instead of improving it.
   */
  const alreadyGenerated = value.summaryGenerated;
  const disabled = !readiness.ready || alreadyGenerated;

  const generate = () => {
    if (disabled) return;
    const draft = generateSummary(value);
    if (!draft) return;
    onGenerate(draft);
  };

  const hint = (): string => {
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
          onClick={generate}
          // Disabled rather than hidden, in both cases: a button that vanishes teaches nothing, and the
          // hint beside it says either which sections are still needed or that the one shot is spent.
          disabled={disabled}
        >
          <Sparkles aria-hidden className="size-4" />
          {messages.resume.generate}
        </Button>

        <p className="text-xs text-muted-foreground" aria-live="polite">
          {hint()}
        </p>
      </div>
    </Section>
  );
}
