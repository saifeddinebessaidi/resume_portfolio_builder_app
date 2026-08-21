import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { PortfolioEditor } from "@/features/portfolio/portfolio-editor";
import { isApiProblem } from "@/lib/api/problem";
import { messages } from "@/messages/fr";
import { projectsApi } from "@/lib/api/endpoints";

export const metadata: Metadata = { title: messages.nav.portfolio };

/**
 * The portfolio editor route — the thing that was missing.
 *
 * Creating a portfolio produced a row and nowhere to go, because this file did not exist: the create
 * button fell through to `router.refresh()` and the category screen had no editor to link to. Same shape
 * as the résumé route, for the same reasons — a server component loads the project from the API (so the
 * payload comes from `ProjectVersion.data` keyed to this user and opens on any device) and hands it to the
 * client editor.
 */
export default async function PortfolioEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const { id } = await params;

  // The try wraps only the fetch: `notFound()` signals by throwing, so building JSX inside it would let
  // this catch swallow a control-flow throw and report it as an API failure.
  let project: Awaited<ReturnType<typeof projectsApi.detail>>;

  try {
    project = await projectsApi.detail(id);
  } catch (error) {
    // 404 means "not found or not yours" — deliberately indistinguishable — so it becomes our own 404.
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
          <Link href="/portfolio" className="text-sm text-muted-foreground hover:text-foreground">
            ← {messages.portfolio.backToList}
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
