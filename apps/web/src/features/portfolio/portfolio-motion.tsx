"use client";

import {
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ReactNode,
} from "react";

/**
 * The motion the ported design needs, without `framer-motion` or `lenis`.
 *
 * The original page pulls both (plus `sonner`) into a route whose whole job is to open fast for a
 * stranger who was sent a link — roughly 40kB gzipped of JavaScript to fade some sections in. Every
 * effect there is either pure CSS (see the `pf-*` keyframes in `globals.css`) or a handful of lines of
 * `IntersectionObserver`. These are the pieces that genuinely need a client: an interval, a scroll
 * position, and a dialog.
 *
 * Each is its own island so the page stays a server component. The markup, spacing and typography are
 * rendered on the server; only these behaviours hydrate.
 */

/**
 * Whether the visitor asked for less motion.
 *
 * `useSyncExternalStore` rather than `useState` + `useEffect`: a media query *is* an external store, and
 * this is the API built for one. It also solves the two problems the effect version has — reading the
 * value during render instead of one paint later (so nothing animates for a frame before being told not
 * to), and a defined server snapshot, since `matchMedia` does not exist there.
 */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia("(prefers-reduced-motion: reduce)");
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    // Server snapshot: assume motion is fine, matching the CSS, which only opts out inside a media query.
    () => false,
  );
}

/**
 * Reveal-on-scroll — the original's `whileInView` with `{ once: true, margin: '-80px' }`.
 *
 * `rootMargin: "-80px"` reproduces that margin exactly: the element must be 80px *inside* the viewport
 * before it counts, so nothing animates while still clipped at the edge. Unobserved after firing, which
 * is what `once: true` meant — a section that re-animates every time it scrolls back into view is
 * distracting on a page this long.
 */
export function Reveal({
  children,
  delay = 0,
  y = 40,
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}): ReactNode {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    /**
     * Already past it on load — a deep link, or a restored scroll position — so show it immediately.
     * Without this, anything above the current scroll position stays at `opacity: 0` forever, because
     * the observer only fires on a *crossing*.
     */
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          setShown(true);
          observer.unobserve(entry.target);
        }
      },
      { rootMargin: "-80px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`pf-reveal ${className}`}
      data-shown={shown}
      style={
        { "--pf-delay": `${String(delay)}s`, "--pf-reveal-y": `${String(y)}px` } as CSSProperties
      }
    >
      {children}
    </div>
  );
}

/**
 * The 2px bar across the top, `origin-left` and scaled by scroll progress.
 *
 * A `scaleX` transform rather than a `width`, exactly as the original: transforms are composited, so
 * this repaints nothing while scrolling. The value is written straight to the DOM node inside a
 * `requestAnimationFrame` — routing it through React state would re-render the whole subtree on every
 * scroll event, which is the one thing a scroll handler must not do.
 */
export function ScrollProgress(): ReactNode {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;

    const update = () => {
      frame = 0;
      const el = ref.current;
      if (!el) return;
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      const progress = scrollable > 0 ? window.scrollY / scrollable : 0;
      el.style.transform = `scaleX(${String(Math.min(1, Math.max(0, progress)))})`;
    };

    const onScroll = () => {
      // Coalesced to one write per frame; a raw scroll listener fires far more often than that.
      frame ||= requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className="fixed inset-x-0 top-0 z-50 h-[2px] origin-left bg-white"
      style={{ transform: "scaleX(0)" }}
    />
  );
}

/**
 * The hero: a crossfading photo stack that also pans as you scroll past it.
 *
 * Both behaviours in one component because they share the same element. The original used two separate
 * framer-motion hooks over the same node; here one rAF-throttled listener writes the parallax transform
 * and an interval advances the photo.
 *
 * The crossfade **stops entirely** under `prefers-reduced-motion` — a hero that changes underneath you
 * every four seconds is precisely what that setting is for, and the CSS rule alone could not stop a
 * `setInterval`.
 */
export function HeroPhotos({
  urls,
  alt,
  videoUrl,
  posterUrl,
  children,
}: {
  urls: string[];
  alt: string;
  /**
   * Portfolio **Pro**: a cover video that replaces the photo slideshow entirely.
   *
   * Replaces rather than layers over. Two moving backgrounds fighting for the same space is noise, and
   * the slideshow's 4-second crossfade would be visible through any video that did not fill the frame.
   */
  videoUrl?: string | undefined;
  posterUrl?: string | undefined;
  /**
   * The hero's text layer, rendered **inside** the fading wrapper.
   *
   * It has to be a child rather than a sibling: the original fades the same node that holds the name and
   * tagline, and the opacity it writes has to land on the element that actually contains them.
   */
  children: ReactNode;
}): ReactNode {
  const reduced = usePrefersReducedMotion();
  const [index, setIndex] = useState(0);
  const layer = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);

  /** No crossfade when a cover video owns the hero — there is no slideshow to advance. */
  useEffect(() => {
    if (reduced || videoUrl || urls.length < 2) return;
    const timer = setInterval(() => setIndex((v) => (v + 1) % urls.length), 4000);
    return () => clearInterval(timer);
  }, [reduced, videoUrl, urls.length]);

  useEffect(() => {
    if (reduced) return;
    let frame = 0;

    const update = () => {
      frame = 0;
      const section = layer.current?.parentElement;
      if (!section || !layer.current || !content.current) return;

      /**
       * Progress through the hero, matching the original's
       * `offset: ['start start', 'end start']` — 0 while the top is at the top of the viewport, 1 once
       * the bottom has reached it. The image then travels 0 → 30% and the text fades out by 0.8.
       */
      const { top, height } = section.getBoundingClientRect();
      const progress = Math.min(1, Math.max(0, -top / height));

      layer.current.style.transform = `translateY(${String(progress * 30)}%)`;
      content.current.style.opacity = String(Math.max(0, 1 - progress / 0.8));
    };

    const onScroll = () => {
      frame ||= requestAnimationFrame(update);
    };

    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, [reduced]);

  return (
    <>
      <div ref={layer} className="pf-parallax absolute inset-0">
        {videoUrl ? (
          /**
           * `muted` + `playsInline` are what make autoplay legal.
           *
           * Every browser blocks an unmuted autoplay, and iOS Safari additionally refuses to play inline
           * without `playsinline` — it takes the video fullscreen instead, which would hijack the page on
           * load. `preload="metadata"` so the poster and dimensions arrive without pulling the whole file
           * before the visitor has scrolled.
           *
           * No `controls`: this is a background, not a player. The reel below is where a visitor watches
           * something, and that one has controls.
           */
          <video
            src={videoUrl}
            poster={posterUrl}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            aria-label={alt}
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : urls.length > 0 ? (
          urls.map((url, i) => (
            <img
              key={url}
              src={url}
              alt={i === 0 ? alt : ""}
              className="absolute inset-0 h-full w-full object-cover transition-opacity duration-[1400ms] ease-in-out"
              style={{ opacity: i === index ? 1 : 0 }}
            />
          ))
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 to-black" />
        )}
        <div className="absolute inset-0 bg-black/40" />
      </div>
      {/* Fades out as the hero leaves; the parallax transform above does not apply to it. */}
      <div
        ref={content}
        className="relative z-10 flex h-full flex-col justify-end px-5 pb-20 sm:px-8 sm:pb-24"
      >
        {children}
      </div>
    </>
  );
}

/**
 * A project's detail dialog — the original's `AnimatePresence` modal.
 *
 * A real `<dialog>` element, which the original was not (it built a `fixed` div and closed on backdrop
 * click). The native element brings focus trapping, `Escape`, `inert` on the rest of the page and the
 * top-layer stacking for free — all things the hand-rolled version silently lacked, and all of which a
 * keyboard user needs.
 *
 * The card is a `<button>` rather than a clickable `<article>` for the same reason: the original bound
 * `onClick` to a div, so the featured projects could not be opened from a keyboard at all.
 */
export function ProjectDialog({
  trigger,
  children,
}: {
  trigger: ReactNode;
  children: ReactNode;
}): ReactNode {
  const dialog = useRef<HTMLDialogElement>(null);

  return (
    <>
      <button
        type="button"
        className="group block w-full cursor-pointer text-left"
        onClick={() => dialog.current?.showModal()}
      >
        {trigger}
      </button>

      <dialog
        ref={dialog}
        /**
         * `backdrop:` styles the native `::backdrop`, which is what replaces the original's hand-built
         * translucent overlay — and unlike a div, it cannot be scrolled past or tabbed behind.
         */
        className="max-h-[88vh] w-full max-w-3xl border border-white/15 bg-neutral-950 text-white backdrop:bg-black/80 backdrop:backdrop-blur-sm"
        onClick={(e) => {
          // Clicking the backdrop closes. The dialog box itself is the only child, so a click whose
          // target *is* the dialog landed outside it.
          if (e.target === dialog.current) dialog.current.close();
        }}
      >
        <div className="max-h-[88vh] overflow-y-auto">{children}</div>
      </dialog>
    </>
  );
}

/** Closes the nearest `<dialog>`. Separate so the dialog's body can stay server-rendered. */
export function DialogClose({ className }: { className?: string }): ReactNode {
  return (
    <button
      type="button"
      aria-label="Fermer"
      className={className}
      onClick={(e) => e.currentTarget.closest("dialog")?.close()}
    >
      ✕
    </button>
  );
}

/**
 * Smooth in-page navigation, the honest replacement for `lenis`.
 *
 * `lenis` hijacks the wheel to interpolate the whole document's scroll. That is 20kB to change the feel
 * of scrolling, it fights the browser's own accessibility behaviour, and it is the single most common
 * source of "the page won't scroll" bug reports. `scrollIntoView({ behavior: "smooth" })` gives the
 * anchor animation, which is the part a visitor actually notices, and respects reduced-motion natively.
 */
export function SmoothLink({
  target,
  children,
  className,
  ariaLabel,
}: {
  /** An element id, or `"top"`. */
  target: string;
  children: ReactNode;
  className?: string;
  ariaLabel?: string;
}): ReactNode {
  return (
    <a
      href={target === "top" ? "#" : `#${target}`}
      aria-label={ariaLabel}
      className={className}
      onClick={(e) => {
        e.preventDefault();
        if (target === "top") {
          window.scrollTo({ top: 0, behavior: "smooth" });
          return;
        }
        document.getElementById(target)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
    >
      {children}
    </a>
  );
}

/**
 * Copies a value and says so inline.
 *
 * The original raised a `sonner` toast, which is another dependency and another portal for one line of
 * feedback. Swapping the label in place is the same information at the point of the action, and it needs
 * no provider mounted at the root of a public page.
 */
export function CopyInline({
  value,
  label,
  className = "",
}: {
  value: string;
  label: string;
  className?: string;
}): ReactNode {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        void navigator.clipboard
          ?.writeText(value)
          .then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
          })
          .catch(() => {
            /* Denied, or an insecure origin. The value is on screen and selectable. */
          });
      }}
    >
      {value} <span className="text-white/30">· {copied ? "copié" : label}</span>
    </button>
  );
}
