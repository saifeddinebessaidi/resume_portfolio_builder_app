"use client";

import { ChevronDown, ChevronUp, Plus, Trash2, X } from "lucide-react";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { messages } from "@/messages/fr";

/**
 * The editor's building blocks — **structure ported from the builder repository's
 * `app/resume/[id]/edit/page.tsx`** (its `Section`, `ItemCard`, `Field` and `Bullets` helpers), with the
 * design changed to REACCHY's dark palette.
 *
 * What was kept: the interaction model. Reorderable cards with up/down/remove, a per-entry bullet list
 * with its own add/remove, and one "+" per section. That model is why the editor works for a CV — the
 * order of jobs is meaningful, and bullets are the unit people actually rewrite.
 *
 * What changed: `bg-white`/`border-neutral-200`/`bg-indigo-600` became the brand tokens, inputs became
 * `rc-input` pills, and cards became `rc-glass`. No behaviour was touched.
 */

export function Field({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

export function TextInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}): ReactNode {
  return (
    <input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="rc-input !py-2 !text-sm"
    />
  );
}

export function TextArea({
  value,
  onChange,
  rows = 3,
  /** Guidance for an empty field. Disappears the moment there is content, unlike a hint below it. */
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
}): ReactNode {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={rows}
      placeholder={placeholder}
      className="rc-input !rounded-2xl !py-2 !text-sm"
    />
  );
}

/** A collapsible group with an optional "+" to append an entry. */
export function Section({
  title,
  onAdd,
  children,
}: {
  title: string;
  onAdd?: () => void;
  children: ReactNode;
}): ReactNode {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-display text-sm uppercase tracking-wider text-muted-foreground">
          {title}
        </h2>
        {onAdd ? (
          <Button type="button" variant="ghost" size="sm" onClick={onAdd}>
            <Plus aria-hidden className="size-4" />
            {messages.resume.add}
          </Button>
        ) : null}
      </div>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  );
}

/**
 * One reorderable entry.
 *
 * The up/down buttons rather than drag-and-drop: order matters on a CV, and two buttons work with a
 * keyboard and a screen reader without a drag library. The builder made the same call.
 */
export function ItemCard({
  onUp,
  onDown,
  onRemove,
  children,
}: {
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
  children: ReactNode;
}): ReactNode {
  return (
    <div className="rc-glass flex flex-col gap-3 !rounded-2xl p-4">
      <div className="flex items-center justify-end gap-1">
        <IconButton label={messages.resume.moveUp} onClick={onUp}>
          <ChevronUp aria-hidden className="size-4" />
        </IconButton>
        <IconButton label={messages.resume.moveDown} onClick={onDown}>
          <ChevronDown aria-hidden className="size-4" />
        </IconButton>
        <IconButton label={messages.resume.remove} onClick={onRemove} destructive>
          <Trash2 aria-hidden className="size-4" />
        </IconButton>
      </div>
      {children}
    </div>
  );
}

function IconButton({
  label,
  onClick,
  destructive = false,
  children,
}: {
  label: string;
  onClick: () => void;
  destructive?: boolean;
  children: ReactNode;
}): ReactNode {
  return (
    <button
      type="button"
      // An accessible name, because the button's content is a glyph. Without it a screen reader
      // announces "button" and the user has no idea which of the three it is.
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "rounded-lg p-1.5 transition-colors",
        destructive
          ? "text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
          : "text-muted-foreground hover:bg-[color-mix(in_oklab,var(--foreground)_8%,transparent)] hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

/**
 * The bullet-list editor.
 *
 * One textarea per bullet rather than one big field split on newlines: bullets are the unit the
 * template renders and the unit the paginator can break across pages, so they are the unit the editor
 * should expose. Splitting a blob on `\n` loses the distinction the moment someone pastes a paragraph.
 */
export function Bullets({
  value,
  onChange,
}: {
  value: string[];
  onChange: (next: string[]) => void;
}): ReactNode {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-xs font-medium text-muted-foreground">{messages.resume.bullets}</span>

      {value.map((b, i) => (
        <div key={i} className="flex items-start gap-1.5">
          <TextArea
            value={b}
            rows={2}
            onChange={(v) => onChange(value.map((x, j) => (j === i ? v : x)))}
          />
          <IconButton
            label={messages.resume.remove}
            destructive
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            <X aria-hidden className="size-4" />
          </IconButton>
        </div>
      ))}

      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => onChange([...value, ""])}
        className="self-start"
      >
        <Plus aria-hidden className="size-4" />
        {messages.resume.addBullet}
      </Button>
    </div>
  );
}

/** Comma-separated list editor, for skill items — which is how the template joins them anyway. */
export function CommaList({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string[];
  onChange: (next: string[]) => void;
}): ReactNode {
  return (
    <Field label={label}>
      <TextInput
        value={value.join(", ")}
        placeholder="TypeScript, NestJS, Prisma"
        onChange={(v) =>
          onChange(
            v
              .split(",")
              .map((s) => s.trim())
              // Filtered on save rather than on keystroke, so typing "a, " does not delete the comma
              // out from under the cursor.
              .filter((s, i, all) => s.length > 0 || i === all.length - 1),
          )
        }
      />
    </Field>
  );
}
