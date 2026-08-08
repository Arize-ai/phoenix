import type { ShouldRevalidateFunction } from "react-router";

/**
 * Search params and hashes only represent client-side view state, so they do
 * not invalidate route loader data.
 */
export const revalidateOnPathChange: ShouldRevalidateFunction = ({
  currentUrl,
  nextUrl,
  defaultShouldRevalidate,
}) => {
  if (currentUrl.pathname === nextUrl.pathname) return false;
  return defaultShouldRevalidate;
};

/**
 * The app shell and project loaders do not depend on the selected project tab
 * or detail drawer. Skipping them keeps same-project navigation from waiting
 * on unrelated loader requests.
 *
 * Phoenix currently has no React Router route actions. Revisit this policy if
 * one is added beneath a project route and requires post-action revalidation.
 */
export const revalidateOutsideSameProject: ShouldRevalidateFunction = (
  args
) => {
  const currentProjectId = args.currentParams.projectId;
  const isSameProject =
    currentProjectId != null && currentProjectId === args.nextParams.projectId;

  if (isSameProject) return false;
  return revalidateOnPathChange(args);
};
