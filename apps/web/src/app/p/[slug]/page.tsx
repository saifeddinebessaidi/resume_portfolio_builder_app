import {
  portfolioPayloadSchema,
  resumePayloadSchema,
  type PublicPublication,
} from "@repo/contracts";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { PublicPortfolio } from "@/features/portfolio/public-portfolio";
import { ResumeSheet } from "@/features/resume/resume-sheet";
import { RecordView } from "./record-view";
import { isApiProblem } from "@/lib/api/problem";
import { publicApi } from "@/lib/api/endpoints";
import { messages } from "@/messages/fr";

/**
 * **`/p/[slug]` — the address every generated link points at.**
 *
 * `publicUrlFor` has been minting `…/p/<slug>` since phase 2, the API has served
 * `GET /public/publications/:slug` unauthenticated for just as long, and this route did not exist — so
 * every link the publish button produced was a 404. This is the missing half.
 *
 * ## Outside `(app)/`
 *
 * No navbar, no "Mon compte", no sign-out. A visitor here is not a user of this product and must not be
 * shown its chrome — the page is the portfolio and nothing else.
 *
 * ## Unauthenticated by construction
 *
 * `publicApi` sends no bearer token, and the response is the API's explicit allow-list: slug, title,
 * category, the published payload, `publishedAt`, `ownerName`. No owner id, no email beyond what the
 * payload itself makes public, no project id, no draft. Nothing here can leak more than the endpoint
 * chose to expose.
 *
 * ## Every failure is a 404, including "it used to be here"
 *
 * The API already collapses no-such-slug, unpublished, expired hosting and deleted project into one 404,
 * specifically so a visitor cannot learn that a portfolio *used to* live at an address. Re-deriving a
 * distinction here would undo that, so this catches 404 and renders the same not-found page as a
 * nonexistent slug. Anything else rethrows — a broken API should look broken, not empty.
 */

/**
 * Re-fetched by both `generateMetadata` and the page.
 *
 * Next dedupes them within one render pass, so this is a single request in practice — and the metadata
 * function needs the real title, because a shared link's preview card is most of the value of sharing it.
 */
async function load(slug: string): Promise<PublicPublication | null> {
  try {
    return await publicApi.publication(slug);
  } catch (error) {
    if (isApiProblem(error) && error.status === 404) return null;
    throw error;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const publication = await load(slug);

  if (!publication) {
    return { title: messages.portfolio.notFoundTitle, robots: { index: false, follow: false } };
  }

  /**
   * Read off the raw payload rather than parsed.
   *
   * `data` is `Record<string, unknown>` for every category, and metadata only needs one optional string.
   * Parsing with the right schema per category here would double the work the page itself already does.
   */
  const { tagline } = publication.data;
  const description =
    typeof tagline === "string" && tagline.trim() ? tagline : messages.app.tagline;

  return {
    title: publication.title,
    description,
    /**
     * **Opts back into indexing**, overriding the root layout's blanket `noindex`.
     *
     * That default is right for the dashboard — a private app has nothing for a crawler — and wrong
     * here: a public portfolio that search engines cannot see is worth much less to the person who
     * published it.
     */
    robots: { index: true, follow: true },
    openGraph: { title: publication.title, description, type: "profile" },
  };
}

export default async function PublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<ReactNode> {
  const { slug } = await params;
  const publication = await load(slug);

  if (!publication) notFound();

  /**
   * Parsed, not cast.
   *
   * A published payload can be older than the current schema — fields added since would be `undefined`
   * and the renderer would print gaps into a page the owner has already shared. `parse` applies the
   * schema's defaults, which is the whole reason they exist.
   */
  switch (publication.categoryCode) {
    case "RESUME":
      return (
        <>
          <RecordView slug={slug} />
          <ResumeSheet data={resumePayloadSchema.parse(publication.data)} />
        </>
      );

    /**
     * One renderer for both. `pro` is the only difference — a cover video in the hero and a video
     * section under Projets — so the design cannot drift between the two categories.
     */
    case "PORTFOLIO":
    case "PORTFOLIO_PRO":
      return (
        <>
          <RecordView slug={slug} />
          <PublicPortfolio
            data={portfolioPayloadSchema.parse(publication.data)}
            ownerName={publication.ownerName}
            pro={publication.categoryCode === "PORTFOLIO_PRO"}
          />
        </>
      );
  }
}
