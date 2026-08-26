import {
  type PortfolioPayload,
  type PortfolioPricing,
  type PortfolioVideo,
  type PortfolioWork,
} from "@repo/contracts";
import type { CSSProperties, ReactNode } from "react";

import {
  CopyInline,
  DialogClose,
  HeroPhotos,
  ProjectDialog,
  Reveal,
  ScrollProgress,
  SmoothLink,
} from "./portfolio-motion";
import { capitalizeFirst, capitalizeSentences, properName } from "@/lib/display-text";
import { messages } from "@/messages/fr";

/**
 * **The public portfolio — the audited repository's design, ported class for class.**
 *
 * `web/app/portfolio/[id]/page.tsx` in that repo is a "Rebirth"-style editorial page and this is it:
 * pure black, white type, Tailwind's default serif for display, the same section order, the same spacing
 * scale, the same `tracking-[0.3em]` labels, the same `text-[15vw]` hero. Every className here is copied
 * from it rather than re-invented — my first version was our own dark-panel house style, which is not
 * what you asked for.
 *
 * Section order, unchanged: progress bar · nav · hero · about · metrics · projects · experiences ·
 * pricing · quote · REACCHY marquee · book-a-call · footer.
 *
 * ## Rendered on the server; motion is four small islands
 *
 * The original is `'use client'` end to end and pulls `framer-motion`, `lenis` and `sonner` — roughly
 * 40kB gzipped — into a page whose entire job is to open quickly for a stranger who was sent a link, and
 * which has no interactivity beyond a modal. Here the markup is server-rendered and only the behaviours
 * that genuinely need a browser hydrate: the scroll-progress bar, the hero's crossfade and parallax, the
 * project dialog, and the copy buttons. Everything else — reveal-on-scroll, the letter-by-letter hero,
 * the marquee — is CSS in `globals.css`. Same design, and the visitor downloads a fraction of it.
 *
 * ## Where it deliberately differs
 *
 * - **`prefers-reduced-motion` is honoured.** The original ignores it, and a full-bleed hero that pans
 *   plus a marquee that never stops are exactly what that setting exists to disable.
 * - **The project card is a `<button>` and the modal is a native `<dialog>`.** The original binds
 *   `onClick` to a `<div>` and `<article>`, so its featured projects cannot be opened from a keyboard,
 *   and its hand-built overlay has no focus trap and no `Escape`.
 * - **Prices convert from minor units** (ADR-0006). The original stored major-unit integers; the
 *   rendered string is the same.
 * - **`showPhone` gates the phone number.** The original stored the flag and its renderer ignored it,
 *   which is how a field a user marked private reaches a public page.
 */

/** One social channel that has a URL. */
interface Social {
  label: string;
  url: string;
}

const PROFESSION_FR: Record<PortfolioPayload["profession"], string> = {
  actress: "Actrice",
  actor: "Acteur",
  model: "Mannequin",
  influencer: "Influenceur·euse",
  content_creator: "Créateur·rice de contenu",
  // "Artiste", not "Autre" — the original's choice, and a public page should not label someone "Other".
  other: "Artiste",
};

const CATEGORY_FR: Record<string, string> = {
  story: "Story",
  reels: "Reels",
  live: "Live",
  events: "Événements",
  other: "Autre",
};

/** 1250 → 1.3K, 2000000 → 2M. The original's own formatter, kept exactly. */
function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(n % 1_000 === 0 ? 0 : 1)}K`;
  return String(n);
}

export function PublicPortfolio({
  data,
  ownerName,
  pro = false,
}: {
  data: PortfolioPayload;
  /** From the account, used only when the payload has no `fullName` of its own. */
  ownerName: string | null;
  /**
   * PORTFOLIO_PRO — **the only difference between the two categories.**
   *
   * Pro adds a cover video in the hero and a video section under Projets. Everything else is identical,
   * so this is one renderer with a flag rather than a duplicated page: the moment they were two files,
   * a fix to the design would have to be made twice and one of them would be forgotten.
   *
   * It also gates *reading* the fields, not just writing them. A PORTFOLIO row that somehow carried a
   * `coverVideoUrl` — an upgraded project, a hand-edited payload — renders without one.
   */
  pro?: boolean;
}): ReactNode {
  /**
   * First **non-empty**, then title-cased.
   *
   * `fullName` defaults to `""`, so `??` would keep the empty string and render a nameless hero. The
   * casing pass is ours: someone types `célia ben salah` in a form and the design sets it at `15vw` in
   * uppercase — but the footer and the `alt` text show it as typed unless it is normalised.
   */
  const name = properName([data.fullName.trim(), ownerName?.trim()].find((v) => v) ?? "Portfolio");
  const profession = PROFESSION_FR[data.profession];
  const photos = data.photos.filter((p) => p.assetUrl.trim());
  /** Cover first, so the hero opens on the chosen image rather than whichever was uploaded first. */
  const heroUrls = [...photos]
    .sort((a, b) => Number(b.isCover) - Number(a.isCover))
    .map((p) => p.assetUrl);

  const featured = data.works.filter((w) => w.featured && w.title.trim());
  const selected = data.works.filter((w) => !w.featured && w.title.trim());

  /**
   * `flatMap` rather than `filter` with a type predicate.
   *
   * A predicate over a union of readonly tuples does not narrow — TypeScript keeps `string | undefined`
   * in position 1 — so the empties are dropped by returning `[]` instead, which narrows for free.
   */
  const socials: Social[] = [
    { label: "Instagram", url: data.instagramUrl },
    { label: "TikTok", url: data.tiktokUrl },
    { label: "YouTube", url: data.youtubeUrl },
  ].flatMap(({ label, url }) => (url?.trim() ? [{ label, url }] : []));

  const hasProjects = featured.length > 0 || selected.length > 0;

  /** Pro only, and only when there is actually a file. */
  const coverVideo = pro ? data.coverVideoUrl?.trim() : undefined;
  const videos = pro ? data.videos.filter((v) => v.assetUrl.trim()) : [];

  /**
   * The pull-quote: brand summary, else the headline.
   *
   * `find` over the trimmed pair rather than `??`, which would keep a whitespace-only `brandSummary` —
   * `"".trim()` is not nullish, so the section would render a pair of empty quote marks at 5xl.
   */
  const quote = [data.brandSummary?.trim(), data.headline?.trim()].find((v) => v);

  return (
    <main className="pf-root">
      <ScrollProgress />

      {/* ------------------------------- nav ------------------------------- */}
      <nav className="pf-nav fixed inset-x-0 top-0 z-40 flex items-center justify-between px-5 py-5 text-xs uppercase tracking-[0.2em] mix-blend-difference sm:px-8">
        <SmoothLink
          target="top"
          ariaLabel="REACCHY"
          className="text-sm font-semibold tracking-[0.35em] hover:opacity-60"
        >
          REACCHY
        </SmoothLink>
        <div className="flex gap-4 sm:gap-6">
          {hasProjects ? (
            <SmoothLink target="projets" className="hover:opacity-60">
              Projets
            </SmoothLink>
          ) : null}
          {videos.length > 0 ? (
            <SmoothLink target="videos" className="hover:opacity-60">
              Vidéos
            </SmoothLink>
          ) : null}
          <SmoothLink target="about" className="hover:opacity-60">
            À propos
          </SmoothLink>
          <SmoothLink target="contact" className="hover:opacity-60">
            Contact
          </SmoothLink>
        </div>
      </nav>

      {/* ------------------------------- hero ------------------------------ */}
      <section className="relative h-[100svh] w-full overflow-hidden">
        <HeroPhotos
          urls={heroUrls}
          alt={name}
          videoUrl={coverVideo}
          posterUrl={data.coverVideoPosterUrl?.trim()}
        >
          <div
            className="pf-fade mb-4 flex items-center justify-between text-xs uppercase tracking-[0.3em] text-white/70"
            style={{ "--pf-delay": "0.15s" } as CSSProperties}
          >
            <span>Portfolio</span>
            <span className="font-medium">2K26</span>
          </div>

          <p
            className="pf-rise mb-3 text-xs uppercase tracking-[0.3em] text-white/70"
            style={{ "--pf-delay": "0.2s" } as CSSProperties}
          >
            {profession} — {data.location}
          </p>

          <h1 className="font-serif text-[15vw] font-semibold uppercase leading-[0.9] tracking-tight sm:text-[10vw]">
            <SplitText text={name} delay={0.35} stagger={0.035} />
          </h1>

          {data.tagline?.trim() ? (
            <p
              className="pf-fade mt-5 max-w-xl text-base text-white/80 sm:text-lg"
              style={{ "--pf-delay": "0.6s" } as CSSProperties}
            >
              {capitalizeFirst(data.tagline)}
            </p>
          ) : null}
        </HeroPhotos>

        <div
          className="pf-fade absolute bottom-6 left-1/2 z-10 -translate-x-1/2 text-[10px] uppercase tracking-[0.3em] text-white/60"
          style={{ "--pf-delay": "1s" } as CSSProperties}
        >
          Défiler
        </div>
      </section>

      {/* ------------------------------ about ----------------------------- */}
      <section
        id="about"
        className="scroll-mt-20 border-t border-white/10 px-5 py-24 sm:px-8 sm:py-32"
      >
        <div className="mx-auto grid max-w-5xl gap-12 md:grid-cols-[1fr_1.4fr]">
          <Reveal>
            <div className="md:sticky md:top-24">
              <h2 className="text-xs uppercase tracking-[0.3em] text-white/50">À propos</h2>
              {data.resumeUrl?.trim() ? (
                <a
                  href={data.resumeUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="mt-6 inline-block border-b border-white/40 pb-0.5 text-sm uppercase tracking-widest hover:border-white"
                >
                  Résumé ↗
                </a>
              ) : null}
              {socials.length > 0 ? <SocialRow socials={socials} className="mt-8" /> : null}
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className="space-y-6 text-lg leading-relaxed text-white/85 sm:text-xl">
              {data.headline?.trim() ? (
                <p className="font-serif text-2xl italic text-white sm:text-3xl">
                  {capitalizeFirst(data.headline)}
                </p>
              ) : null}

              {/* Blank-line-separated paragraphs, as authored. The original splits on /\n{2,}/. */}
              {(data.biography ?? "")
                .split(/\n{2,}/)
                .filter((p) => p.trim())
                .map((paragraph, i) => (
                  <p key={i}>{capitalizeSentences(paragraph)}</p>
                ))}

              {data.skills.length > 0 ? (
                <div className="flex flex-wrap gap-2 pt-4">
                  {data.skills.map((skill) => (
                    <span
                      key={skill}
                      className="border border-white/30 px-3 py-1 text-xs uppercase tracking-wide text-white/80"
                    >
                      {capitalizeFirst(skill)}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </Reveal>
        </div>
      </section>

      {/* ----------------------------- metrics ---------------------------- */}
      <Metrics data={data} />

      {/* ---------------------------- projects ---------------------------- */}
      {hasProjects ? (
        <section
          id="projets"
          className="scroll-mt-20 border-t border-white/10 px-5 py-24 sm:px-8 sm:py-32"
        >
          <div className="mx-auto max-w-5xl">
            <Reveal>
              <h2 className="mb-12 text-xs uppercase tracking-[0.3em] text-white/50">Projets</h2>
            </Reveal>

            <div className="space-y-20">
              {featured.map((work, i) => (
                <Reveal key={`f${String(i)}`} delay={0.05 * i}>
                  <ProjectDialog
                    trigger={
                      <div className="grid gap-6 md:grid-cols-2 md:items-center">
                        {imageFor(work, i, photos) ? (
                          <div className="aspect-[4/3] w-full overflow-hidden">
                            <img
                              src={imageFor(work, i, photos) ?? ""}
                              alt={work.title}
                              className="h-full w-full scale-[1.18] object-cover grayscale transition-[filter] duration-700 group-hover:grayscale-0"
                            />
                          </div>
                        ) : null}
                        <div>
                          {work.category?.trim() ? (
                            <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                              {capitalizeFirst(work.category)}
                            </p>
                          ) : null}
                          <h3 className="mt-2 font-serif text-3xl sm:text-4xl">
                            {capitalizeFirst(work.title)}
                          </h3>
                          {work.description?.trim() ? (
                            <p className="mt-4 line-clamp-3 leading-relaxed text-white/75">
                              {capitalizeSentences(work.description)}
                            </p>
                          ) : null}
                          <span className="mt-5 inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-white/60 transition-colors group-hover:text-white">
                            Voir le projet <span aria-hidden>→</span>
                          </span>
                        </div>
                      </div>
                    }
                  >
                    <ProjectDetail work={work} image={imageFor(work, i, photos)} />
                  </ProjectDialog>
                </Reveal>
              ))}
            </div>

            {selected.length > 0 ? (
              <div className="mt-20 border-t border-white/10">
                {selected.map((work, i) => (
                  <Reveal key={`s${String(i)}`} delay={0.03 * i}>
                    <ProjectDialog
                      trigger={
                        <div className="grid w-full grid-cols-[1fr_auto] items-baseline gap-4 border-b border-white/10 py-6 text-left transition-colors group-hover:bg-white/[0.03]">
                          <div>
                            <h4 className="font-serif text-xl transition-transform group-hover:translate-x-1 sm:text-2xl">
                              {capitalizeFirst(work.title)}
                            </h4>
                            {work.description?.trim() ? (
                              <p className="mt-1 line-clamp-1 text-sm text-white/60">
                                {capitalizeSentences(work.description)}
                              </p>
                            ) : null}
                          </div>
                          <span className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-white/50">
                            {capitalizeFirst(work.category)}
                            <span
                              aria-hidden
                              className="transition-transform group-hover:translate-x-1"
                            >
                              →
                            </span>
                          </span>
                        </div>
                      }
                    >
                      <ProjectDetail
                        work={work}
                        image={imageFor(work, featured.length + i, photos)}
                      />
                    </ProjectDialog>
                  </Reveal>
                ))}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* ----------------------------- videos ----------------------------- */}
      {videos.length > 0 ? (
        <section
          id="videos"
          className="scroll-mt-20 border-t border-white/10 px-5 py-24 sm:px-8 sm:py-32"
        >
          <div className="mx-auto max-w-5xl">
            <Reveal>
              <h2 className="mb-12 text-xs uppercase tracking-[0.3em] text-white/50">
                {messages.portfolio.videosSectionTitle}
              </h2>
            </Reveal>

            {/**
             * One column for the first video, two for the rest.
             *
             * The reel's opening piece is the showreel — the thing a casting director watches — so it
             * gets the full width. Giving every video an equal cell would bury it, and the design's whole
             * grammar is one large item followed by a grid (see the featured/selected split in Projets).
             */}
            <div className="space-y-6">
              <Reveal>
                <VideoFigure video={videos[0]!} />
              </Reveal>

              {videos.length > 1 ? (
                <div className="grid gap-6 sm:grid-cols-2">
                  {videos.slice(1).map((video, i) => (
                    <Reveal key={`${video.assetUrl}-${String(i)}`} delay={0.05 * i}>
                      <VideoFigure video={video} />
                    </Reveal>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </section>
      ) : null}

      {/* --------------------------- experiences -------------------------- */}
      {data.experiences.length > 0 ? (
        <section className="border-t border-white/10 px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto max-w-5xl">
            <Reveal>
              <h2 className="mb-12 text-xs uppercase tracking-[0.3em] text-white/50">
                Expériences &amp; collaborations
              </h2>
            </Reveal>
            <div className="border-t border-white/10">
              {data.experiences
                .filter((e) => e.title.trim())
                .map((item, i) => (
                  <Reveal key={`${item.title}-${String(i)}`} delay={0.03 * i}>
                    <div className="grid grid-cols-[auto_1fr_auto] items-baseline gap-4 border-b border-white/10 py-5">
                      {/* Em dash when no year — `||` not `??`, because "" must fall through too. */}
                      <span className="font-mono text-xs text-white/40">
                        {item.year?.trim() ? item.year : "—"}
                      </span>
                      <div>
                        <span className="text-lg">{capitalizeFirst(item.title)}</span>
                        {item.role?.trim() ? (
                          <span className="ml-2 text-sm text-white/60">
                            · {capitalizeFirst(item.role)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </Reveal>
                ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ----------------------------- pricing ---------------------------- */}
      {data.pricing.length > 0 ? (
        <section className="border-t border-white/10 px-5 py-24 sm:px-8 sm:py-32">
          <div className="mx-auto max-w-5xl">
            <Reveal>
              <h2 className="mb-12 text-xs uppercase tracking-[0.3em] text-white/50">Tarifs</h2>
            </Reveal>
            {/* gap-px over a white/10 background is what draws the hairline grid between cells. */}
            <div className="grid gap-px overflow-hidden border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
              {data.pricing.map((rate, i) => (
                <Reveal key={`${rate.label}-${String(i)}`} delay={0.04 * i} className="bg-black">
                  <div className="h-full p-8">
                    {rate.label.trim() ? (
                      <>
                        <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                          {CATEGORY_FR[rate.category] ?? rate.category}
                        </p>
                        <h3 className="mt-3 font-serif text-2xl">{capitalizeFirst(rate.label)}</h3>
                      </>
                    ) : (
                      <h3 className="font-serif text-2xl">
                        {CATEGORY_FR[rate.category] ?? rate.category}
                      </h3>
                    )}
                    <p className="mt-4 text-lg text-white/85">{formatRate(rate)}</p>
                  </div>
                </Reveal>
              ))}
            </div>
            <p className="mt-6 text-xs text-white/40">
              Tarifs indicatifs — devis personnalisé sur demande.
            </p>
          </div>
        </section>
      ) : null}

      {/* ------------------------------ quote ----------------------------- */}
      {quote ? (
        <section className="border-t border-white/10 px-5 py-28 sm:px-8 sm:py-40">
          <Reveal className="mx-auto max-w-4xl">
            <p className="font-serif text-3xl leading-snug tracking-tight sm:text-5xl">
              “{capitalizeSentences(quote)}”
            </p>
          </Reveal>
        </section>
      ) : null}

      {/* --------------------------- brand banner ------------------------- */}
      <section
        aria-label="REACCHY"
        className="overflow-hidden border-t border-white/10 py-12 sm:py-16"
      >
        <div className="pf-marquee">
          {[0, 1].map((half) => (
            // The run is duplicated so the -50% slide lands on an identical frame; the copy is hidden
            // from assistive tech.
            <div key={half} className="flex shrink-0" aria-hidden={half === 1}>
              {Array.from({ length: 6 }).map((_, i) => (
                <span
                  key={i}
                  className="mx-6 font-serif text-5xl font-semibold uppercase tracking-tight text-white/90 sm:mx-10 sm:text-7xl"
                >
                  Reacchy <span className="align-middle text-white/25">✦</span>
                </span>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ---------------------------- book a call ------------------------- */}
      <section
        id="contact"
        className="scroll-mt-20 border-t border-white/10 px-5 py-24 text-center sm:px-8 sm:py-36"
      >
        <Reveal className="mx-auto max-w-3xl">
          <p className="text-xs uppercase tracking-[0.3em] text-white/50">Travaillons ensemble</p>
          <h2 className="mt-6 font-serif text-4xl leading-tight sm:text-6xl">Réserver un appel</h2>
          {data.availabilityText?.trim() ? (
            <p className="mt-6 text-white/75">{data.availabilityText}</p>
          ) : null}
          {data.availabilityDate?.trim() ? (
            <p className="mt-1 text-sm text-white/50">
              Prochaine disponibilité : {data.availabilityDate}
            </p>
          ) : null}
          {data.email.trim() ? (
            <a
              href={`mailto:${data.email}`}
              className="mt-10 inline-flex h-12 items-center rounded-full bg-white px-8 text-sm font-medium uppercase tracking-widest text-black transition-transform hover:scale-105"
            >
              Prendre contact
            </a>
          ) : null}
        </Reveal>
      </section>

      {/* ----------------------------- footer ----------------------------- */}
      <footer className="border-t border-white/10 px-5 py-16 sm:px-8">
        <div className="mx-auto grid max-w-5xl gap-10 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="font-serif text-2xl">{name}</p>
            <p className="mt-1 text-sm text-white/50">
              {profession} — {data.location}
            </p>
            {data.addressText?.trim() ? (
              <p className="mt-4 max-w-xs text-sm text-white/50">{data.addressText}</p>
            ) : null}
          </div>
          <div className="space-y-3 text-sm">
            {data.email.trim() ? (
              <CopyInline
                value={data.email}
                label="copier"
                className="block text-left text-white/70 hover:text-white"
              />
            ) : null}
            {/* Opt-in, and honoured — the flag exists so that leaving it off withholds the number. */}
            {data.showPhone && data.phone?.trim() ? (
              <CopyInline
                value={data.phone}
                label="copier"
                className="block text-left text-white/70 hover:text-white"
              />
            ) : null}
            {socials.length > 0 ? <SocialRow socials={socials} className="pt-1" /> : null}
          </div>
        </div>
        <div className="mx-auto mt-12 flex max-w-5xl items-center justify-between border-t border-white/10 pt-6 text-xs text-white/40">
          <span>© 2026 {name}</span>
          <SmoothLink target="top" className="uppercase tracking-widest hover:text-white">
            Haut de page ↑
          </SmoothLink>
        </div>
      </footer>
    </main>
  );
}

/* ------------------------------------------------------------------------------------------------
 * Pieces
 * ---------------------------------------------------------------------------------------------- */

/**
 * The stat row: **one figure per network**, then reach and engagement.
 *
 * ## Why this stopped summing
 *
 * It used to add Instagram, TikTok and YouTube together under a single "Abonnés" label. That is what the
 * reference profile does *not* do — it names each network — and the difference matters to the person
 * being read. "418 abonnés" says nothing about where, and a brand evaluating a creator is deciding
 * whether the audience is on the platform they are buying. A named 418 on Instagram is a fact they can
 * act on; an anonymous 418 is a number they have to ask about.
 *
 * It also removed the one place in the product where a figure was presented without its source, which is
 * the exact thing the generator's prompt forbids for the written copy.
 *
 * ## Only what exists
 *
 * A network with no count is dropped rather than shown as zero — "0 abonnés TikTok" on a portfolio is
 * worse than silence, and someone who does not use TikTok has not failed to fill in a field. The grid
 * sizes itself to what survives, so one network renders one wide column rather than one number and two
 * gaps.
 */
function Metrics({ data }: { data: PortfolioPayload }): ReactNode {
  const stats: [string, number][] = (
    [
      ["Instagram", data.instagramFollowers],
      ["TikTok", data.tiktokFollowers],
      ["YouTube", data.youtubeSubscribers],
      ["Reach", data.reach],
      ["Engagement", data.engagement],
    ] as const
  ).flatMap(([label, value]) => (value ? [[label, value] as [string, number]] : []));

  if (stats.length === 0) return null;

  return (
    <section
      id="stats"
      className="scroll-mt-20 border-t border-white/10 px-5 py-20 sm:px-8 sm:py-28"
    >
      <div
        className="mx-auto grid max-w-5xl gap-8 sm:gap-10"
        // Inline rather than a Tailwind class: the column count is data-dependent, and Tailwind only
        // emits classes it can see in the source — `grid-cols-${n}` would compile to nothing.
        style={{
          gridTemplateColumns: `repeat(${String(Math.min(stats.length, 3))}, minmax(0, 1fr))`,
        }}
      >
        {stats.map(([label, value], i) => (
          <Reveal key={label} delay={i * 0.1} className="text-center">
            <p className="font-serif text-4xl font-semibold tabular-nums sm:text-6xl">
              {formatCount(value)}
            </p>
            <p className="mt-2 text-[10px] uppercase tracking-[0.3em] text-white/50 sm:text-xs">
              {label}
            </p>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function ProjectDetail({ work, image }: { work: PortfolioWork; image: string | null }): ReactNode {
  return (
    <>
      {image ? (
        <img src={image} alt={work.title} className="aspect-[16/9] w-full object-cover" />
      ) : null}
      <div className="p-6 sm:p-10">
        <div className="flex items-start justify-between gap-4">
          <div>
            {work.category?.trim() ? (
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">
                {capitalizeFirst(work.category)}
              </p>
            ) : null}
            <h3 className="mt-2 font-serif text-3xl sm:text-4xl">{capitalizeFirst(work.title)}</h3>
          </div>
          <DialogClose className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/25 text-white/70 hover:bg-white hover:text-black" />
        </div>
        {work.description?.trim() ? (
          <p className="mt-6 whitespace-pre-line leading-relaxed text-white/80">
            {capitalizeSentences(work.description)}
          </p>
        ) : null}
      </div>
    </>
  );
}

/**
 * One video in the reel — **presented like the cover, not like a player.**
 *
 * Autoplaying, muted, looping, no controls and no caption, matching the hero in `portfolio-motion.tsx`.
 * The page then reads as one continuous piece of motion rather than a hero followed by a row of video
 * widgets with grey chrome and filenames under them.
 *
 * ## What this deliberately gives up
 *
 * The previous version had `controls` and `preload="none"`, and the reasoning behind it was real: a page
 * with six videos that all autoplay downloads six videos, and on a phone that is somebody's data. That
 * cost is now accepted for the sake of the design.
 *
 * Three things keep it from being reckless, and they are why this is safe enough to do:
 *
 * - **`muted` is mandatory**, not stylistic. Every browser blocks autoplay with sound; without it the
 *   video silently refuses to start and the section renders as a still frame.
 * - **`preload="metadata"`**, as the hero uses — the poster and dimensions load, the video body does not
 *   until playback begins.
 * - **`poster`** still renders first, so a blocked or slow video shows the intended frame rather than a
 *   black rectangle.
 *
 * If the reel grows past three or four videos this should become play-on-scroll-into-view via
 * `IntersectionObserver` — same appearance, but only the visible video is fetched.
 */
function VideoFigure({ video }: { video: PortfolioVideo }): ReactNode {
  return (
    <figure className="overflow-hidden border border-white/10">
      <video
        src={video.assetUrl}
        poster={video.posterUrl}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        // The title is no longer painted on the page, so it becomes the accessible name instead of
        // being dropped — a silent, unlabelled, uncontrollable video is invisible to a screen reader.
        aria-label={video.title?.trim() ? capitalizeFirst(video.title) : undefined}
        className="aspect-video w-full bg-black object-cover"
      />
    </figure>
  );
}

function SocialRow({
  socials,
  className = "",
}: {
  socials: Social[];
  className?: string;
}): ReactNode {
  return (
    <div className={`flex gap-3 ${className}`}>
      {socials.map(({ label, url }) => (
        <a
          key={label}
          href={url}
          target="_blank"
          /**
           * `nofollow` on top of the original's `noopener noreferrer`: these URLs come from a user, and a
           * public page that hands out follow links is a link farm waiting to be found.
           */
          rel="noopener noreferrer nofollow"
          aria-label={label}
          title={label}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-white/25 text-white/80 transition-colors hover:border-white hover:bg-white hover:text-black"
        >
          <SocialIcon name={label} />
        </a>
      ))}
    </div>
  );
}

/**
 * The brand glyphs, as inline paths copied from the original.
 *
 * Inline rather than from `lucide-react`, which dropped its brand icons — and inline rather than a new
 * icon dependency, because three `<path>` strings are the whole requirement.
 */
function SocialIcon({ name }: { name: string }): ReactNode {
  const paths: Record<string, string> = {
    Instagram:
      "M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16Zm0 1.62c-3.15 0-3.5.01-4.74.07-.96.04-1.48.2-1.83.34-.46.18-.79.39-1.13.74-.34.34-.56.67-.74 1.13-.14.35-.3.87-.34 1.83-.06 1.24-.07 1.59-.07 4.74s.01 3.5.07 4.74c.04.96.2 1.48.34 1.83.18.46.39.79.74 1.13.34.34.67.56 1.13.74.35.14.87.3 1.83.34 1.24.06 1.59.07 4.74.07s3.5-.01 4.74-.07c.96-.04 1.48-.2 1.83-.34.46-.18.79-.39 1.13-.74.34-.34.56-.67.74-1.13.14-.35.3-.87.34-1.83.06-1.24.07-1.59.07-4.74s-.01-3.5-.07-4.74c-.04-.96-.2-1.48-.34-1.83a3.04 3.04 0 0 0-.74-1.13 3.04 3.04 0 0 0-1.13-.74c-.35-.14-.87-.3-1.83-.34-1.24-.06-1.59-.07-4.74-.07Zm0 2.76a5.46 5.46 0 1 1 0 10.92 5.46 5.46 0 0 1 0-10.92Zm0 1.62a3.84 3.84 0 1 0 0 7.68 3.84 3.84 0 0 0 0-7.68Zm5.65-2.9a1.28 1.28 0 1 1 0 2.56 1.28 1.28 0 0 1 0-2.56Z",
    TikTok:
      "M16.6 5.82a4.5 4.5 0 0 1-1.07-2.98h-3.4v12.27a2.6 2.6 0 1 1-2.6-2.6c.27 0 .53.04.78.12v-3.46a6 6 0 1 0 5.2 5.94V9.4a7.7 7.7 0 0 0 4.5 1.45V7.4a4.5 4.5 0 0 1-3.41-1.58Z",
    YouTube:
      "M23.5 6.2a3 3 0 0 0-2.1-2.12C19.5 3.5 12 3.5 12 3.5s-7.5 0-9.4.58A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.1 2.12C4.5 20.5 12 20.5 12 20.5s7.5 0 9.4-.58a3 3 0 0 0 2.1-2.12A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8ZM9.6 15.6V8.4l6.2 3.6-6.2 3.6Z",
  };

  const path = paths[name];
  if (!path) return <span className="h-5 w-5">↗</span>;

  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

/**
 * Letter-by-letter blur-in — the hero's signature, in CSS.
 *
 * The per-letter delay is an inline `animationDelay` rather than framer-motion's `transition.delay`; the
 * arithmetic `(word * 4 + i) * stagger` is the original's, so the rhythm is identical. Words are
 * `whitespace-nowrap` blocks so a line break never lands mid-word at `15vw`.
 *
 * `aria-label` carries the name and every letter is `aria-hidden`, or a screen reader would announce it
 * one character at a time.
 */
function SplitText({
  text,
  delay = 0,
  stagger = 0.03,
}: {
  text: string;
  delay?: number;
  stagger?: number;
}): ReactNode {
  const words = text.split(" ");

  return (
    <span aria-label={text}>
      {words.map((word, w) => (
        <span key={`${word}-${String(w)}`} className="inline-block whitespace-nowrap" aria-hidden>
          {[...word].map((char, i) => (
            <span
              key={i}
              className="pf-letter"
              style={{ animationDelay: `${String(delay + (w * 4 + i) * stagger)}s` }}
            >
              {char}
            </span>
          ))}
          {w < words.length - 1 ? <span className="inline-block">&nbsp;</span> : null}
        </span>
      ))}
    </span>
  );
}

/**
 * A project's image, falling back to the uploaded gallery — the original's `imageFor`.
 *
 * Deliberate: a portfolio whose projects have no images of their own still renders as a photo-led page
 * rather than as bare text, which is the whole point of the layout.
 */
function imageFor(
  work: PortfolioWork,
  index: number,
  photos: PortfolioPayload["photos"],
): string | null {
  if (work.imageUrl?.trim()) return work.imageUrl;
  if (photos.length === 0) return null;
  return photos[index % photos.length]?.assetUrl ?? null;
}

/**
 * A rate line. `250 – 400 TND`, `dès 250 TND`, `jusqu’à 400 TND`, `Sur demande` — the original's exact
 * strings.
 *
 * **Converted from integer minor units** (ADR-0006), which the original did not have to do: it stored
 * major-unit integers. The divisor comes from the currency because TND has three decimal places and
 * EUR/USD two, and the result is rounded — nobody quotes a modelling fee in millimes.
 */
function formatRate({ priceMinMinor, priceMaxMinor, currency }: PortfolioPricing): string {
  const exponent = currency === "TND" ? 1000 : 100;
  const major = (minor: number | undefined): string | null =>
    minor === undefined ? null : String(Math.round(minor / exponent));

  const min = major(priceMinMinor);
  const max = major(priceMaxMinor);

  if (min && max) return min === max ? `${min} ${currency}` : `${min} – ${max} ${currency}`;
  if (min) return `dès ${min} ${currency}`;
  if (max) return `jusqu’à ${max} ${currency}`;
  return "Sur demande";
}
