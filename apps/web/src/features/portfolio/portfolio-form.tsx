"use client";

import { type PortfolioPayload } from "@repo/contracts";
import { X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { GenerateContentButton } from "./generate-content-button";
import { PortfolioPhotos } from "./portfolio-photos";
import { PortfolioVideos } from "./portfolio-videos";
import { messages } from "@/messages/fr";

/**
 * The portfolio form — **field for field, and in the same order, as the live `/generate/[id]` page** in
 * the audited repository.
 *
 * Seven sections: Identité · Réseaux & audience · Contenu du portfolio · Expérience · Tarifs · Projets ·
 * Photos. My first version grouped things differently and wrapped every entry in the résumé editor's
 * cards — that was my invention rather than the reference, and it read as a different product.
 *
 * ## Compact rows, not cards
 *
 * Expérience and Tarifs are single-line grids — `[type | titre | rôle | année | ×]` — exactly as the
 * reference has them. A card per entry is easier to build from our existing primitives and wrong here: a
 * rate card is a **table** you scan down to compare prices, and a bordered box per line destroys the
 * column alignment that makes it readable.
 *
 * ## The selects were white
 *
 * The reference pins `[color-scheme:light]` because that app is light-themed. Inheriting that literally is
 * what made the dropdowns render as white boxes on our obsidian panel. `color-scheme: dark` was the first
 * half of the fix; the second — an opaque control background and explicit `option` colours — lives in
 * `globals.css`. See the `SELECT` constant below for why one is not enough without the other.
 *
 * ## What is deliberately absent
 *
 * `showPhone`, `showDob`, `addressText`, `availabilityText`, `availabilityDate`, `resumeUrl` and
 * `dateOfBirth` exist in the payload — the reference's own renderer reads several of them — but its
 * `/generate` form does not collect them, so neither does this. They stay in the schema rather than being
 * deleted: removing a field the renderer reads would be a silent regression, and you asked for this form,
 * not a redesigned data model.
 */

/**
 * Dark-scheme select, matching our inputs.
 *
 * `color-scheme: dark` is necessary and **was not sufficient**: Chromium paints the open option list from
 * the control's own `background-color`, and `rc-input`'s is translucent, so the popup composited it onto
 * white and every option rendered white-on-white. The rest of the fix — an opaque control background and
 * explicit `option` colours — is in `globals.css`, because it has to out-rank a Tailwind utility and
 * cannot be expressed as one.
 */
const SELECT = "rc-input !rounded-2xl !py-2 !text-sm";

const GENDERS: [string, string][] = [
  ["", "—"],
  ["female", messages.portfolio.genders.female],
  ["male", messages.portfolio.genders.male],
  ["non-binary", messages.portfolio.genders.nonBinary],
  ["prefer_not", messages.portfolio.genders.preferNot],
];

const PROFESSIONS: [PortfolioPayload["profession"], string][] = [
  ["actress", messages.portfolio.professions.actress],
  ["actor", messages.portfolio.professions.actor],
  ["model", messages.portfolio.professions.model],
  ["influencer", messages.portfolio.professions.influencer],
  ["content_creator", messages.portfolio.professions.content_creator],
  ["other", messages.portfolio.professions.other],
];

type ArrayKey = "experiences" | "pricing" | "works" | "photos";

export function PortfolioForm({
  projectId,
  value,
  onChange,
  saveFirst,
  pro,
}: {
  /** Needed only by the generate button, which posts to `/api/projects/:id/portfolio-content`. */
  projectId: string;
  value: PortfolioPayload;
  onChange: (next: PortfolioPayload) => void;
  /** The editor's autosave flush. Awaited before generating — see `GenerateContentButton`. */
  saveFirst: () => Promise<void>;
  /**
   * PORTFOLIO_PRO. The **only** difference between the two categories: Pro adds a cover video and a
   * video reel. Everything else — every field, the order, the layout — is shared, which is why this is a
   * flag on one form rather than a second form.
   */
  pro: boolean;
}): ReactNode {
  const set = <K extends keyof PortfolioPayload>(key: K, v: PortfolioPayload[K]) =>
    onChange({ ...value, [key]: v });

  /** Blank clears the optional number instead of storing 0 — "0 abonnés" is not "unknown". */
  const setNumber = (key: keyof PortfolioPayload, raw: string) => {
    if (raw.trim() === "") {
      const { [key]: _dropped, ...rest } = value;
      onChange(rest as PortfolioPayload);
      return;
    }
    const n = Number(raw);
    if (Number.isFinite(n) && n >= 0) onChange({ ...value, [key]: Math.round(n) });
  };

  function add<K extends ArrayKey>(key: K, blank: PortfolioPayload[K][number]): void {
    onChange({ ...value, [key]: [...value[key], blank] });
  }
  function update<K extends ArrayKey>(
    key: K,
    i: number,
    patch: Partial<PortfolioPayload[K][number]>,
  ): void {
    onChange({ ...value, [key]: value[key].map((it, j) => (j === i ? { ...it, ...patch } : it)) });
  }
  function remove<K extends ArrayKey>(key: K, i: number): void {
    onChange({ ...value, [key]: value[key].filter((_, j) => j !== i) });
  }

  return (
    <div className="grid gap-8">
      {/* ---------------- Identité ---------------- */}
      <Block title={messages.portfolio.sections.identity}>
        <Row label={`${messages.portfolio.fullName} *`}>
          <Input value={value.fullName} onChange={(v) => set("fullName", v)} />
        </Row>

        <div className="grid gap-4 sm:grid-cols-2">
          <Row label={`${messages.portfolio.profession} *`}>
            <select
              className={SELECT}
              value={value.profession}
              onChange={(e) => set("profession", e.target.value as PortfolioPayload["profession"])}
            >
              {PROFESSIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Row>
          <Row label={messages.portfolio.gender}>
            <select
              className={SELECT}
              value={value.gender ?? ""}
              onChange={(e) => set("gender", e.target.value)}
            >
              {GENDERS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Row>
        </div>

        <Row label={`${messages.portfolio.location} *`}>
          <Input
            value={value.location}
            placeholder={messages.portfolio.locationPlaceholder}
            onChange={(v) => set("location", v)}
          />
        </Row>

        <div className="grid gap-4 sm:grid-cols-2">
          <Row label={`${messages.account.email} *`}>
            <Input type="email" value={value.email} onChange={(v) => set("email", v)} />
          </Row>
          <Row label={messages.portfolio.phone}>
            <Input value={value.phone ?? ""} onChange={(v) => set("phone", v)} />
          </Row>
        </div>

        {/**
         * **The publish switch for the phone number.**
         *
         * `showPhone` was in the payload and honoured by the public page from the start, but no control
         * ever set it — so it sat at its `false` default forever and the number could not be shown by
         * any means. Storing a field, reading it, and giving nobody a way to change it is worse than not
         * having it: the renderer looks broken and the data looks ignored.
         *
         * It was left out originally because the reference's own form does not collect it. That was the
         * wrong call for this field specifically: the reference *does* read it, and a number a user
         * typed into a portfolio form is one they expect to appear on the portfolio.
         *
         * Default stays `false`. Opt-in is the only defensible default for publishing a personal phone
         * number to a page anyone with the link can read.
         */}
        {value.phone?.trim() ? (
          <label className="flex cursor-pointer items-center gap-2.5 text-sm">
            <input
              type="checkbox"
              checked={value.showPhone}
              onChange={(e) => set("showPhone", e.target.checked)}
              className="size-4 accent-[var(--primary)]"
            />
            <span className="text-muted-foreground">{messages.portfolio.showPhone}</span>
          </label>
        ) : null}

        <Row label={messages.portfolio.tagline}>
          <Input
            value={value.tagline ?? ""}
            placeholder={messages.portfolio.taglinePlaceholder}
            onChange={(v) => set("tagline", v)}
          />
        </Row>

        <Row label={messages.portfolio.description}>
          <Area rows={3} value={value.description ?? ""} onChange={(v) => set("description", v)} />
        </Row>
      </Block>

      {/* ---------------- Réseaux & audience ---------------- */}
      <Block title={messages.portfolio.sections.socials} hint={messages.portfolio.audienceHint}>
        {(
          [
            ["Instagram", "instagramUrl", "instagramFollowers"],
            ["TikTok", "tiktokUrl", "tiktokFollowers"],
            ["YouTube", "youtubeUrl", "youtubeSubscribers"],
          ] as const
        ).map(([label, urlKey, countKey]) => (
          <div key={label} className="grid grid-cols-[1fr_120px] gap-2">
            <Input
              value={value[urlKey] ?? ""}
              placeholder={`${label} — URL`}
              onChange={(v) => set(urlKey, v)}
            />
            <Input
              type="number"
              value={value[countKey]?.toString() ?? ""}
              placeholder={messages.portfolio.followersShort}
              onChange={(v) => setNumber(countKey, v)}
            />
          </div>
        ))}

        <div className="grid gap-4 pt-1 sm:grid-cols-2">
          <Row label={messages.portfolio.reach}>
            <Input
              type="number"
              value={value.reach?.toString() ?? ""}
              placeholder="ex : 250000"
              onChange={(v) => setNumber("reach", v)}
            />
          </Row>
          <Row label={messages.portfolio.engagement}>
            <Input
              type="number"
              value={value.engagement?.toString() ?? ""}
              placeholder="ex : 12000"
              onChange={(v) => setNumber("engagement", v)}
            />
          </Row>
        </div>
      </Block>

      {/* ---------------- Contenu du portfolio ---------------- */}
      <Block title={messages.portfolio.sections.content} hint={messages.portfolio.contentHint}>
        {/**
         * The generator sits at the top of the block it writes, not in a toolbar.
         *
         * These four fields are its entire output, so the control belongs where its effect is visible —
         * press it and the inputs immediately below fill in. A button elsewhere on the page would leave
         * the user hunting for what changed.
         */}
        <GenerateContentButton
          projectId={projectId}
          value={value}
          saveFirst={saveFirst}
          onGenerated={(content) =>
            onChange({
              ...value,
              headline: content.headline,
              biography: content.biography,
              brandSummary: content.brandSummary,
              // Only replaced when the model actually returned some — never wipe the user's own list.
              skills: content.skills.length > 0 ? content.skills : value.skills,
            })
          }
        />

        <Row label={messages.portfolio.headline}>
          <Input value={value.headline ?? ""} onChange={(v) => set("headline", v)} />
        </Row>
        <Row label={messages.portfolio.biography}>
          <Area rows={6} value={value.biography ?? ""} onChange={(v) => set("biography", v)} />
        </Row>
        <Row label={messages.portfolio.skillsLabel}>
          {/* Comma-separated in a textarea, as the reference has it — not a tag editor. */}
          <SkillsField skills={value.skills} onChange={(skills) => set("skills", skills)} />
        </Row>
        <Row label={messages.portfolio.brandSummary}>
          <Area
            rows={4}
            value={value.brandSummary ?? ""}
            onChange={(v) => set("brandSummary", v)}
          />
        </Row>
      </Block>

      {/* ---------------- Expérience ---------------- */}
      <Block title={messages.portfolio.sections.experiences}>
        {value.experiences.map((e, i) => (
          <div key={i} className="grid grid-cols-[104px_1fr_100px_74px_auto] items-center gap-2">
            <select
              className={SELECT}
              value={e.type}
              onChange={(ev) =>
                update("experiences", i, {
                  type: ev.target.value as PortfolioPayload["experiences"][number]["type"],
                })
              }
            >
              <option value="acting_credit">{messages.portfolio.types.acting_credit}</option>
              <option value="brand_collab">{messages.portfolio.types.brand_collab}</option>
              <option value="other">{messages.portfolio.types.other}</option>
            </select>
            <Input
              value={e.title}
              placeholder={messages.portfolio.experiencePlaceholder}
              onChange={(v) => update("experiences", i, { title: v })}
            />
            <Input
              value={e.role ?? ""}
              placeholder={messages.portfolio.role}
              onChange={(v) => update("experiences", i, { role: v })}
            />
            <Input
              value={e.year ?? ""}
              placeholder={messages.portfolio.year}
              onChange={(v) => update("experiences", i, { year: v })}
            />
            <RemoveButton onClick={() => remove("experiences", i)} />
          </div>
        ))}
        <AddButton
          label={messages.portfolio.addExperience}
          onClick={() => add("experiences", { type: "acting_credit", title: "" })}
        />
      </Block>

      {/* ---------------- Tarifs ---------------- */}
      <Block title={messages.portfolio.sections.pricing}>
        {value.pricing.map((p, i) => (
          <div
            key={i}
            className="grid grid-cols-[104px_1fr_80px_80px_72px_auto] items-center gap-2"
          >
            <select
              className={SELECT}
              value={p.category}
              onChange={(e) => update("pricing", i, { category: e.target.value })}
            >
              {/**
               * Story first, then reel, live, event — the reference profile's own order and its full
               * set. `story` was missing entirely, which is the cheapest prestation an influencer sells
               * and usually the first line of their rate card.
               *
               * The existing `reels` / `events` values are kept rather than renamed to the reference's
               * singular: `category` is free text in stored payloads, and renaming the value would leave
               * every saved rate card pointing at an option that no longer exists — the `<select>` would
               * silently show the first entry instead, quietly rewriting someone's prices on next save.
               */}
              <option value="story">{messages.portfolio.pricingCategories.story}</option>
              <option value="reels">{messages.portfolio.pricingCategories.reels}</option>
              <option value="live">{messages.portfolio.pricingCategories.live}</option>
              <option value="events">{messages.portfolio.pricingCategories.events}</option>
              <option value="other">{messages.portfolio.pricingCategories.other}</option>
            </select>
            <Input
              value={p.label}
              placeholder={messages.portfolio.pricingLabelPlaceholder}
              onChange={(v) => update("pricing", i, { label: v })}
            />
            {/**
             * Entered in **major** units, stored in minor (ADR-0006): the currency exponent lives in one
             * place in `@repo/contracts`, and 250 TND travels as 250000 millimes.
             */}
            <Input
              type="number"
              value={p.priceMinMinor === undefined ? "" : String(p.priceMinMinor / 1000)}
              placeholder="min"
              onChange={(v) =>
                update("pricing", i, {
                  priceMinMinor: v.trim() === "" ? undefined : Math.round(Number(v) * 1000),
                })
              }
            />
            <Input
              type="number"
              value={p.priceMaxMinor === undefined ? "" : String(p.priceMaxMinor / 1000)}
              placeholder="max"
              onChange={(v) =>
                update("pricing", i, {
                  priceMaxMinor: v.trim() === "" ? undefined : Math.round(Number(v) * 1000),
                })
              }
            />
            <select
              className={SELECT}
              value={p.currency}
              onChange={(e) =>
                update("pricing", i, {
                  currency: e.target.value as PortfolioPayload["pricing"][number]["currency"],
                })
              }
            >
              <option value="TND">TND</option>
              <option value="EUR">EUR</option>
              <option value="USD">USD</option>
            </select>
            <RemoveButton onClick={() => remove("pricing", i)} />
          </div>
        ))}
        <AddButton
          label={messages.portfolio.addPricing}
          onClick={() => add("pricing", { category: "reels", label: "", currency: "TND" })}
        />
      </Block>

      {/* ---------------- Projets ---------------- */}
      <Block title={messages.portfolio.sections.works}>
        {value.works.map((w, i) => (
          <div key={i} className="grid gap-2 rounded-2xl border border-border p-3">
            <div className="grid grid-cols-[1fr_140px_auto] items-center gap-2">
              <Input
                value={w.title}
                placeholder={messages.portfolio.workTitlePlaceholder}
                onChange={(v) => update("works", i, { title: v })}
              />
              <Input
                value={w.category ?? ""}
                placeholder={messages.portfolio.workCategory}
                onChange={(v) => update("works", i, { category: v })}
              />
              <label className="flex items-center gap-1.5 whitespace-nowrap text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  checked={w.featured}
                  onChange={(e) => update("works", i, { featured: e.target.checked })}
                  className="size-3.5 accent-[var(--primary)]"
                />
                {messages.portfolio.featured}
              </label>
            </div>
            <Area
              rows={2}
              value={w.description ?? ""}
              placeholder={messages.portfolio.workDescriptionPlaceholder}
              onChange={(v) => update("works", i, { description: v })}
            />
            <Input
              value={w.imageUrl ?? ""}
              placeholder={messages.portfolio.imageUrl}
              onChange={(v) => update("works", i, { imageUrl: v })}
            />
            <button
              type="button"
              onClick={() => remove("works", i)}
              className="w-fit text-xs text-muted-foreground hover:text-foreground"
            >
              {messages.resume.remove}
            </button>
          </div>
        ))}
        <AddButton
          label={messages.portfolio.addWork}
          onClick={() => add("works", { title: "", featured: false })}
        />
      </Block>

      {/* ---------------- Photos ---------------- */}
      <Block title={messages.portfolio.sections.photos}>
        <PortfolioPhotos value={value.photos} onChange={(photos) => set("photos", photos)} />
      </Block>

      {/**
       * ---------------- Portfolio Pro: video ----------------
       *
       * Two blocks, and the only thing Pro adds. The cover sits with Photos because it competes with
       * them for the same slot — it *replaces* the hero slideshow — and the reel sits last because on the
       * public page it comes after Projets.
       */}
      {pro ? (
        <>
          <Block title={messages.portfolio.coverVideo}>
            <PortfolioVideos
              mode="single"
              value={value.coverVideoUrl ?? ""}
              onChange={(next) =>
                // Cleared to `undefined` rather than "": an empty string would be stored and then read
                // as a video URL by anything doing a truthiness check on the field.
                set("coverVideoUrl", typeof next === "string" && next ? next : undefined)
              }
            />
          </Block>

          <Block title={messages.portfolio.videos} hint={messages.portfolio.videoSectionNote}>
            <PortfolioVideos
              mode="many"
              value={value.videos}
              onChange={(next) => {
                if (Array.isArray(next)) set("videos", next);
              }}
            />
          </Block>
        </>
      ) : null}
    </div>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Local primitives.
 *
 * Not the résumé editor's `Section` / `Field` / `ItemCard`: those wrap every entry in a card, which is
 * right for a CV's prose blocks and wrong for a rate card. Matching the reference meant matching its
 * density, so this form owns four small components rather than bending shared ones out of shape.
 * ---------------------------------------------------------------------------------------------- */

function Block({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: ReactNode;
}): ReactNode {
  return (
    <section className="grid gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      {hint ? <p className="text-xs text-muted-foreground/80">{hint}</p> : null}
      {children}
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: "text" | "email" | "number";
}): ReactNode {
  return (
    <input
      type={type}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="rc-input !rounded-2xl !py-2 !text-sm"
    />
  );
}

function Area({
  value,
  onChange,
  rows,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows: number;
  placeholder?: string;
}): ReactNode {
  return (
    <textarea
      rows={rows}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className="rc-input !rounded-2xl !py-2 !text-sm"
    />
  );
}

/**
 * **Compétences — a text field you can actually type into.**
 *
 * The list is stored as `string[]` and was rendered straight from it: `value={skills.join(", ")}`, with
 * every keystroke split on `,`, trimmed and emptied-filtered on the way back. That round trip is lossy at
 * exactly the moment it matters. Type `Photo` then `,` and the parse yields `["Photo"]`, which re-renders
 * as `"Photo"` — the comma is deleted under the cursor. The following space is eaten the same way, so a
 * separator can never be entered and the whole list has to be typed as one run-on word.
 *
 * The fix is to stop deriving the input's value from the parsed array. The raw text is the state while
 * the field is being edited; the array is what that text *means*, recomputed on every change for the
 * payload. Both directions stay live — the parent still receives skills as it types, and no character is
 * ever rewritten under the cursor.
 *
 * The buffer is still not the *only* source: "Générer le contenu" replaces `skills` from outside, and
 * that has to appear here. So the rendered value is the buffer **while the buffer still means the list we
 * were given**, and the list otherwise — one comparison per render, no syncing effect and no stale
 * snapshot to invalidate. The next keystroke re-seeds the buffer from whatever is on screen.
 */
function SkillsField({
  skills,
  onChange,
}: {
  skills: string[];
  onChange: (skills: string[]) => void;
}): ReactNode {
  const [buffer, setBuffer] = useState(() => skills.join(", "));

  const text = sameList(parseSkills(buffer), skills) ? buffer : skills.join(", ");

  return (
    <Area
      rows={2}
      value={text}
      placeholder={messages.portfolio.skillsPlaceholder}
      onChange={(next) => {
        setBuffer(next);
        onChange(parseSkills(next));
      }}
    />
  );
}

/** Trailing empties are dropped, so a trailing "," in the field is a separator, not a blank skill. */
const parseSkills = (raw: string): string[] =>
  raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const sameList = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((item, i) => item === b[i]);

/** The reference's bare `×`, given a real accessible name — a lone glyph reads as nothing aloud. */
function RemoveButton({ onClick }: { onClick: () => void }): ReactNode {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={messages.resume.remove}
      title={messages.resume.remove}
      className="text-muted-foreground transition-colors hover:text-foreground"
    >
      <X aria-hidden className="size-4" />
    </button>
  );
}

function AddButton({ label, onClick }: { label: string; onClick: () => void }): ReactNode {
  return (
    <Button type="button" variant="ghost" size="sm" className="w-fit" onClick={onClick}>
      {label}
    </Button>
  );
}
