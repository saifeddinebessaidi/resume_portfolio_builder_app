import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { ResumeEditor } from "@/features/resume/resume-editor";
import { isApiProblem } from "@/lib/api/problem";
import { messages } from "@/messages/fr";
import { projectsApi } from "@/lib/api/endpoints";

export const metadata: Metadata = { title: messages.nav.resume };

/**
 * The editor route.
 *
 * A server component loads the project — **from the database, via the API** — and hands the payload to
 * the client editor. That is the whole storage change from the builder repository in one line: the data
 * comes from `ProjectVersion.data` keyed to this user, so the same CV opens on any device.
 *
 * A 404 from the API means "not found or not yours" (they are deliberately indistinguishable), and
 * `notFound()` turns that into our own French 404 rather than surfacing an API error.
 */
export default async function ResumeEditorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<ReactNode> {
  const { id } = await params;

  /**
   * The try/catch wraps **only** the fetch, and the JSX is built after it.
   *
   * `notFound()` signals by throwing, and so does every Next navigation helper — so constructing JSX
   * inside the try would let this catch swallow a control-flow throw raised by a child and report it as
   * an API failure. Narrow the try to the one call that can genuinely fail.
   */
  let project: Awaited<ReturnType<typeof projectsApi.detail>>;

  try {
    project = await projectsApi.detail(id);
  } catch (error) {
    // A 404 from the API means "not found or not yours" — deliberately indistinguishable — so it
    // becomes our own French 404 rather than a leaked API error.
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
          <Link href="/resume" className="text-sm text-muted-foreground hover:text-foreground">
            ← {messages.resume.backToList}
          </Link>
          <h1 className="font-display mt-1 text-2xl">
            <span className="rc-gradient-text">{project.title}</span>
          </h1>
        </div>
        <Badge tone="neutral">
          v{project.currentVersion} · {messages.quota.revisions} {project.revisionCount}/
          {project.revisionLimit ?? "∞"}
        </Badge>
      </div>

      <ResumeEditor project={project} />
    </div>
  );
}
