import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { PortfolioEditor } from "@/features/portfolio/portfolio-editor";
import { isApiProblem } from "@/lib/api/problem";
import { messages } from "@/messages/fr";
import { projectsApi } from "@/lib/api/endpoints";

export const metadata: Metadata = { title: messages.nav.portfolioPro };

/**
 * Portfolio Pro's editor — the same component and the same payload schema as standard Portfolio.
 *
 * Not laziness: the two are priced identically with byte-identical seeded features, and **open question 2
 * ("what does Pro actually include?") is still unanswered**. Inventing a difference here would encode a
 * product decision nobody has made, in the one place a customer would then see it. When Pro is defined it
 * gets its own schema entry and whatever extra sections it earns; this route is where they land.
 */
export default async function PortfolioProEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const { id } = await params;

  let project: Awaited<ReturnType<typeof projectsApi.detail>>;

  try {
    project = await projectsApi.detail(id);
  } catch (error) {
    /**
     * 404 **or 422**.
     *
     * 404 means "not found or not yours" — deliberately indistinguishable. 422 means the id in the URL is
     * not a well-formed project id, which a hand-edited or truncated link produces; rethrowing that gave
     * a 500 for what is, from the visitor's side, exactly the same fact: there is no such project here.
     */
    if (isApiProblem(error) && (error.status === 404 || error.status === 422)) notFound();
    throw error;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/portfolio-pro"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← {messages.portfolio.backToListPro}
          </Link>
          <h1 className="font-display mt-1 text-2xl">
            <span className="rc-gradient-text">{project.title}</span>
          </h1>
        </div>
      </div>

      <PortfolioEditor project={project} />
    </div>
  );
}
