/**
 * How a profile link is **printed** — as its network's name, not as its URL.
 *
 * ## Why the URL is not shown
 *
 * `https://www.linkedin.com/in/prenom-nom-2b41a7193/` is forty-odd characters of noise carrying about
 * one character of information. In a designed template's sidebar it wraps across three lines and pushes
 * the section below it down the page; in the ATS header it crowds out the phone number and the city. The
 * word "LinkedIn" says the same thing in eight characters, and the address is still *in* the document —
 * it is the anchor's `href`, so it survives `window.print()` and is clickable in the PDF.
 *
 * The cost is real and worth stating: **on paper the label is not actionable.** A recruiter holding a
 * printout can see that you are on LinkedIn but cannot type their way to your profile. That is your call,
 * taken knowingly; the handle (`syrine-larbi`) was the alternative that keeps a printout usable.
 *
 * ## The labels are not translated
 *
 * "LinkedIn" and "GitHub" are trade names — they are the same in a French CV and an English one, which is
 * why they live here as constants rather than in `SHEET_LABELS` beside `t.experience`. "Portfolio" is
 * spelled identically in both languages and was already the ATS template's own wording for the field.
 */
export const PROFILE_LINK_KEYS = ["website", "github", "linkedin"] as const;

export type ProfileLinkKey = (typeof PROFILE_LINK_KEYS)[number];

export const PROFILE_LINK_LABEL: Record<ProfileLinkKey, string> = {
  website: "Portfolio",
  github: "GitHub",
  linkedin: "LinkedIn",
};

export const isProfileLinkKey = (key: string): key is ProfileLinkKey =>
  (PROFILE_LINK_KEYS as readonly string[]).includes(key);

/**
 * A usable `href` from whatever the user typed.
 *
 * People enter "github.com/x" as readily as the full address, and a bare host in an `href` is resolved
 * as a *relative path* — so the link would point at our own dashboard. Lifted out of `ats-template.tsx`,
 * where it was a private helper, because the designed templates now need exactly the same rule: the
 * label is the only thing on the page, so if the `href` behind it is wrong there is nothing left to fall
 * back on.
 */
export const absoluteUrl = (v: string): string =>
  /^https?:\/\//i.test(v) ? v : `https://${v.replace(/^\/+/, "")}`;
