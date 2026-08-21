"use client";

import {
  ResumeTemplateStyle,
  type ResumeTemplateId,
  styleOfTemplate,
  templatesForStyle,
} from "@repo/contracts";
import { useState, type ReactNode } from "react";

import { TemplateThumb } from "./template-thumb";
import { cn } from "@/lib/cn";
import { messages } from "@/messages/fr";

/**
 * Convention tab, then a row of template cards — the shape you asked for, and the order matters.
 *
 * A North-American résumé and a European CV are different documents, not two skins of one: the first
 * omits photo and date of birth and keeps to a page, the second commonly carries both. Choosing the
 * *convention* first means the templates on offer are only ever the ones appropriate to where the CV is
 * going, so the look is picked inside a decision already narrowed correctly.
 *
 * ## Why a drawn thumbnail rather than a live mini-render
 *
 * Each card shows a small schematic — the sidebar, the rail, the rules — not a scaled copy of the real
 * sheet. Four live A4 renders behind `transform: scale()` would mean four full template trees mounted at
 * all times, re-rendering on every keystroke, to be shown at 40 px wide where no text is legible anyway.
 * The schematic communicates the one thing a chooser needs at that size — **where the blocks sit** — for
 * effectively nothing. The real preview is already on screen next to it.
 *
 * ## Pictures only, no captions
 *
 * The cards carry no name and no badge — the thumbnail is the whole card. Four names plus four ATS badges
 * turned a row of previews into a wall of text, and a chooser recognises a layout by its shape anyway.
 *
 * The ATS caveat still matters (two-column designs read better to a human and *worse* to a naive parser,
 * which crosses the page left-to-right and interleaves the sidebar into the job descriptions), so it lives
 * in the tooltip and the accessible name rather than being deleted.
 */
export function TemplatePicker({
  value,
  onChange,
}: {
  value: ResumeTemplateId;
  onChange: (id: ResumeTemplateId) => void;
}): ReactNode {
  /**
   * The open tab is component state, not payload data: it is derivable from the selected template, and
   * storing it would create a second field that could disagree with the first. It opens on whichever
   * convention the current template belongs to.
   */
  const [style, setStyle] = useState<ResumeTemplateStyle>(() => styleOfTemplate(value));

  const available = templatesForStyle(style);

  /**
   * Collapsed by default, like "Sections comptées".
   *
   * A `<details>` rather than a hand-rolled toggle: the open/closed state, the keyboard behaviour and the
   * disclosure semantics come from the element, and the browser keeps it working before any JavaScript
   * loads. It also matches the one other collapsible in this editor, so the pattern reads as deliberate
   * rather than incidental.
   *
   * Defaulting to closed is the right bias: a template is chosen once and then the user spends their time
   * in the form, so the picker should not hold eight rows of vertical space for the rest of the session.
   * The current choice is named in the summary, so it is still legible while collapsed.
   */
  return (
    <details className="flex flex-col gap-3">
      <summary className="cursor-pointer text-xs font-medium text-muted-foreground hover:text-foreground">
        {messages.resume.templateStyle}
        <span className="ml-1.5 opacity-70">· {messages.resume.templates[value]}</span>
      </summary>

      <div className="mt-3 flex flex-col gap-3">
        <div role="tablist" aria-label={messages.resume.templateStyle} className="flex gap-2">
          {Object.values(ResumeTemplateStyle).map((s) => (
            <button
              key={s}
              type="button"
              role="tab"
              aria-selected={style === s}
              onClick={() => setStyle(s)}
              className={cn(
                "rounded-full border px-3 py-1.5 text-xs transition-colors",
                style === s
                  ? "border-primary bg-[color-mix(in_oklab,var(--primary)_18%,transparent)] text-foreground"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {messages.resume.templateStyles[s]}
              {/* Count on the tab, so an empty convention is visible before it is clicked. */}
              <span className="ml-1.5 opacity-60">{templatesForStyle(s).length}</span>
            </button>
          ))}
        </div>

        {available.length === 0 ? (
          /* Europe, today. An honest empty state rather than hiding the tab — the convention exists and is
           coming, and hiding it would make the product look narrower than it is. */
          <p className="text-xs text-muted-foreground">{messages.resume.templateStyleEmpty}</p>
        ) : (
          <div
            role="radiogroup"
            aria-label={messages.resume.template}
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
          >
            {available.map((t) => {
              const selected = t.id === value;

              return (
                <button
                  key={t.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => onChange(t.id)}
                  /**
                   * **The card is the picture and nothing else**, by your call — no name, no ATS badge.
                   *
                   * The thumbnail already says what the label would: a chooser recognises the layout by its
                   * shape, and four names plus four badges turned a row of previews into a wall of text.
                   *
                   * The information is not deleted, only moved off the surface: the accessible name and the
                   * hover tooltip still carry the template's name and whether it is machine-readable, so a
                   * screen-reader user is not handed four unlabelled buttons and the ATS caveat stays
                   * discoverable for anyone who wants it.
                   */
                  aria-label={`${messages.resume.templates[t.id]} — ${
                    t.atsSafe ? messages.resume.atsSafe : messages.resume.atsRisky
                  }`}
                  title={`${messages.resume.templates[t.id]} — ${
                    t.atsSafe ? messages.resume.atsSafeHint : messages.resume.atsRiskyHint
                  }`}
                  className={cn(
                    "flex items-center justify-center rounded-xl border p-1.5 transition-all",
                    selected
                      ? "border-primary ring-2 ring-[color-mix(in_oklab,var(--primary)_45%,transparent)]"
                      : "border-border hover:border-[color-mix(in_oklab,var(--foreground)_25%,transparent)]",
                  )}
                >
                  <TemplateThumb id={t.id} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </details>
  );
}
