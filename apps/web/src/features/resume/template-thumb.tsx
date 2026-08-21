import { type ResumeTemplateId } from "@repo/contracts";
import type { ReactNode } from "react";

/**
 * A drawn schematic of a template's layout, at thumbnail size.
 *
 * Inline SVG on an A4 aspect ratio (the `viewBox` is 42×59, near enough 210×297 to read as a page). It
 * shows **where the blocks sit** — the only thing legible at 40 px, and the only thing a chooser needs:
 * is the name centred or left, is there a sidebar, is it tinted, does a rail run down the middle.
 *
 * Drawn rather than rendered because a scaled live copy of the real sheet would mount four full template
 * trees permanently and re-render them on every keystroke, to display text nobody can read at this size.
 * `aria-hidden` because the card's own label already names the template.
 *
 * The greys are deliberately flat rather than the brand palette: the point is layout, and colouring the
 * schematic like the app would suggest the CV comes out in the app's colours.
 */
const INK = "#8b8b93";
const FAINT = "#c9c9d1";

export function TemplateThumb({ id }: { id: ResumeTemplateId }): ReactNode {
  return (
    <svg
      viewBox="0 0 42 59"
      aria-hidden
      className="h-[59px] w-[42px] shrink-0 rounded-[2px] bg-white shadow-sm ring-1 ring-black/10"
    >
      {THUMBS[id]}
    </svg>
  );
}

/** A run of text lines, so each schematic is a few shapes rather than dozens of hand-placed rects. */
function Lines({
  x,
  y,
  w,
  count,
  gap = 2.6,
  color = FAINT,
  h = 1.1,
}: {
  x: number;
  y: number;
  w: number;
  count: number;
  gap?: number;
  color?: string;
  h?: number;
}): ReactNode {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <rect
          key={i}
          x={x}
          y={y + i * gap}
          width={i === count - 1 ? w * 0.66 : w}
          height={h}
          rx={0.4}
          fill={color}
        />
      ))}
    </>
  );
}

const THUMBS: Record<ResumeTemplateId, ReactNode> = {
  /** ATS: one column, a heading rule, plain runs of text. */
  ats: (
    <>
      <rect x={5} y={5} width={22} height={2.6} rx={0.5} fill={INK} />
      <Lines x={5} y={10} w={32} count={2} />
      <rect x={5} y={17} width={32} height={0.7} fill={INK} />
      <Lines x={5} y={20} w={32} count={4} />
      <rect x={5} y={33} width={32} height={0.7} fill={INK} />
      <Lines x={5} y={36} w={32} count={5} />
    </>
  ),

  /** Classic: centred name, contact strip between rules, ruled sections, a skills grid. */
  classic: (
    <>
      <rect x={11} y={5} width={20} height={2.8} rx={0.5} fill={INK} />
      <rect x={15} y={9.5} width={12} height={1} rx={0.4} fill={FAINT} />
      <rect x={5} y={13} width={32} height={0.6} fill={FAINT} />
      <rect x={12} y={15} width={18} height={1} rx={0.4} fill={FAINT} />
      <rect x={5} y={17.5} width={32} height={0.6} fill={FAINT} />
      <rect x={5} y={21} width={13} height={1.4} rx={0.4} fill={INK} />
      <rect x={5} y={23.4} width={32} height={0.5} fill={INK} />
      {/* the date gutter */}
      <Lines x={5} y={26} w={8} count={2} />
      <Lines x={16} y={26} w={21} count={2} />
      <rect x={5} y={33} width={13} height={1.4} rx={0.4} fill={INK} />
      <rect x={5} y={35.4} width={32} height={0.5} fill={INK} />
      <Lines x={5} y={38} w={8} count={2} />
      <Lines x={16} y={38} w={21} count={2} />
      {/* skills, four columns */}
      <rect x={5} y={45} width={13} height={1.4} rx={0.4} fill={INK} />
      <rect x={5} y={47.8} width={32} height={0.5} fill={INK} />
      {[5, 13, 21, 29].map((x) => (
        <Lines key={x} x={x} y={50.5} w={6} count={2} gap={2.4} />
      ))}
    </>
  ),

  /** Timeline: full-width name, left sidebar, and a rail with badges down the main column. */
  timeline: (
    <>
      <rect x={4} y={5} width={24} height={2.8} rx={0.5} fill={INK} />
      <rect x={4} y={9.5} width={14} height={1} rx={0.4} fill={FAINT} />
      {/* sidebar */}
      <rect x={4} y={14} width={11} height={1.2} rx={0.4} fill={INK} />
      <rect x={4} y={16} width={11} height={0.5} fill={INK} />
      <Lines x={4} y={18} w={11} count={3} gap={2.4} />
      <rect x={4} y={28} width={11} height={1.2} rx={0.4} fill={INK} />
      <rect x={4} y={30} width={11} height={0.5} fill={INK} />
      <Lines x={4} y={32} w={11} count={5} gap={2.4} />
      {/* the rail */}
      <rect x={18.4} y={14} width={0.6} height={40} fill={FAINT} />
      {[15, 27, 41].map((y) => (
        <circle key={y} cx={18.7} cy={y} r={1.5} fill={INK} />
      ))}
      <Lines x={22} y={14.5} w={15} count={2} gap={2.4} />
      <Lines x={22} y={26.5} w={15} count={3} gap={2.4} />
      <Lines x={22} y={40.5} w={15} count={5} gap={2.4} />
    </>
  ),

  /** Blush: rounded frame, centred serif name with a monogram, tinted sidebar. */
  blush: (
    <>
      <rect
        x={2.5}
        y={2.5}
        width={37}
        height={54}
        rx={3}
        fill="none"
        stroke="#f0dede"
        strokeWidth={0.8}
      />
      <circle cx={24} cy={8} r={3.4} fill="#f6e7e7" />
      <rect x={11} y={7} width={20} height={2.4} rx={0.5} fill={INK} />
      <rect x={15} y={11.5} width={12} height={1} rx={0.4} fill={FAINT} />
      {/* tinted sidebar */}
      <rect x={2.5} y={15} width={14} height={41.5} fill="#f6e7e7" />
      <rect x={5} y={18} width={9} height={1.2} rx={0.4} fill={INK} />
      <Lines x={5} y={20.5} w={9} count={3} gap={2.3} color="#c9a3a3" />
      <rect x={5} y={30} width={9} height={1.2} rx={0.4} fill={INK} />
      <Lines x={5} y={32.5} w={9} count={4} gap={2.3} color="#c9a3a3" />
      {/* main column */}
      <rect x={19} y={18} width={11} height={1.2} rx={0.4} fill={INK} />
      <Lines x={19} y={20.5} w={17} count={3} gap={2.3} />
      <rect x={19} y={30} width={11} height={1.2} rx={0.4} fill={INK} />
      <Lines x={19} y={32.5} w={17} count={6} gap={2.3} />
    </>
  ),

  /** Aurora: cream panel with a curved right edge, circular photo, serif name right, skill chips. */
  aurora: (
    <>
      <path d="M0 0 H16 C25 15, 25 44, 16 59 H0 Z" fill="#e8e0d3" />
      <circle cx={8} cy={11} r={5.4} fill="#c9bfae" />
      <Lines x={3.5} y={21} w={9} count={3} gap={2.6} color="#bdb2a0" />
      <Lines x={3.5} y={33} w={9} count={3} gap={2.6} color="#bdb2a0" />
      <rect x={22} y={6} width={16} height={3} rx={0.6} fill={INK} />
      <rect x={26} y={11} width={12} height={1.6} rx={0.5} fill={INK} />
      <rect x={22.4} y={19} width={0.5} height={34} fill="#d5c9b6" />
      {[20, 33, 46].map((y) => (
        <circle key={y} cx={22.7} cy={y} r={1.3} fill={INK} />
      ))}
      <Lines x={26} y={19} w={12} count={3} gap={2.4} />
      <Lines x={26} y={32} w={12} count={3} gap={2.4} />
      {[26, 33].map((x) => (
        <rect key={x} x={x} y={45} width={6} height={3} rx={1} fill="#e8e0d3" />
      ))}
      {[26, 33].map((x) => (
        <rect key={`b${x}`} x={x} y={49.5} width={6} height={3} rx={1} fill="#e8e0d3" />
      ))}
    </>
  ),

  /** Navy: dark sidebar, full-bleed photo at its top, white text reversed out. */
  navy: (
    <>
      <rect x={0} y={0} width={16} height={59} fill="#2c3d51" />
      <rect x={0} y={0} width={16} height={17} fill="#4a5f77" />
      <rect x={3} y={21} width={10} height={1.4} rx={0.4} fill="#ffffff" />
      <Lines x={3} y={24} w={10} count={3} gap={2.2} color="#8ba0b8" />
      <rect x={3} y={34} width={10} height={1.4} rx={0.4} fill="#ffffff" />
      <Lines x={3} y={37} w={10} count={3} gap={2.2} color="#8ba0b8" />
      <rect x={20} y={6} width={17} height={3} rx={0.6} fill="#2c3d51" />
      <rect x={20} y={11.5} width={11} height={1.3} rx={0.4} fill={FAINT} />
      <rect x={20} y={18} width={11} height={1.4} rx={0.4} fill="#2c3d51" />
      <rect x={20} y={20.6} width={5} height={0.6} fill="#2c3d51" />
      <Lines x={20} y={23} w={17} count={3} gap={2.3} />
      <rect x={20} y={33} width={11} height={1.4} rx={0.4} fill="#2c3d51" />
      <rect x={20} y={35.6} width={5} height={0.6} fill="#2c3d51" />
      <Lines x={20} y={38} w={6} count={3} gap={2.3} />
      <Lines x={28} y={38} w={9} count={3} gap={2.3} />
    </>
  ),

  /** Terracotta: single column, circular photo left of the name, warm rules, three-column footer. */
  terracotta: (
    <>
      <circle cx={8} cy={9} r={5} fill="#d8c3b3" />
      <rect x={15} y={6} width={20} height={2.6} rx={0.5} fill={INK} />
      <rect x={15} y={10.5} width={13} height={1.2} rx={0.4} fill="#a9714b" />
      <Lines x={4} y={17} w={33} count={2} gap={2.2} />
      <rect x={4} y={24} width={14} height={1.4} rx={0.4} fill="#a9714b" />
      <rect x={4} y={26.4} width={33} height={0.4} fill="#c99b78" />
      <Lines x={4} y={29} w={9} count={2} gap={2.2} color="#c99b78" />
      <Lines x={16} y={29} w={21} count={3} gap={2.2} />
      <rect x={4} y={39} width={14} height={1.4} rx={0.4} fill="#a9714b" />
      <rect x={4} y={41.4} width={33} height={0.4} fill="#c99b78" />
      <Lines x={4} y={44} w={9} count={2} gap={2.2} color="#c99b78" />
      <Lines x={16} y={44} w={21} count={2} gap={2.2} />
      {[4, 16, 28].map((x) => (
        <rect key={x} x={x} y={52} width={8} height={1.2} rx={0.4} fill="#a9714b" />
      ))}
      {[4, 16, 28].map((x) => (
        <Lines key={`f${x}`} x={x} y={55} w={8} count={2} gap={2} />
      ))}
    </>
  ),
};
