import { permanentRedirect } from "next/navigation";

/**
 * **Old `/p/<slug>` links.** Public pages now live at `/<slug>`; links shared before the move keep working.
 */
export default async function LegacyPublicPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<never> {
  const { slug } = await params;
  permanentRedirect(`/${encodeURIComponent(slug)}`);
}
