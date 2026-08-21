import { type ProjectDetail } from "@repo/contracts";

/**
 * May this user have an **unwatermarked** copy of this project?
 *
 * One rule, evaluated on the server, used by both the editor preview and the print route.
 *
 * **The rule is simply "has a download been paid for on this project".** `exportCount` only ever
 * increases through `POST /projects/:id/exports`, which is entitlement-gated — so a non-zero count is
 * proof that an allowance was actually spent here. Before that, every rendering is watermarked;
 * afterwards the user can re-print the clean copy as often as they like, because they bought it.
 *
 * Deriving it from `exportCount` rather than from "does the user currently hold a subscription" matters:
 * a lapsed subscriber must keep the copy they already paid for, and a fresh subscriber must not get
 * clean copies of CVs they never spent a download on.
 *
 * **This is why the print route cannot be bypassed.** Navigating straight to `/resume/:id/print` skips
 * the export call, so `exportCount` is 0, so the print is watermarked. The paywall is a property of the
 * data, not of the path taken to reach it.
 */
export const hasCleanCopy = (project: Pick<ProjectDetail, "exportCount">): boolean =>
  project.exportCount > 0;
