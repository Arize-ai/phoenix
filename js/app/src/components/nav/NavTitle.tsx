import { Suspense, use } from "react";
import { useLocation } from "react-router";

import {
  type Crumb,
  useMatchesWithCrumb,
} from "@phoenix/hooks/useMatchesWithCrumb";

export function NavTitle() {
  const matchesWithCrumb = useMatchesWithCrumb();
  const { pathname } = useLocation();
  const crumbs = matchesWithCrumb.map((match) =>
    match.handle.crumb(match.loaderData)
  );
  const loadedCrumbs = crumbs.filter(isLoadedCrumb);
  const hasLoadingCrumb = loadedCrumbs.length < crumbs.length;
  if (!hasLoadingCrumb) {
    return <Title crumbs={loadedCrumbs} />;
  }
  // Keyed for the reason NavBreadcrumb gives.
  return (
    <Suspense key={pathname} fallback={<Title crumbs={loadedCrumbs} />}>
      <ResolvedTitle crumbs={crumbs} />
    </Suspense>
  );
}

const isLoadedCrumb = (crumb: Crumb): crumb is string =>
  typeof crumb === "string";

function ResolvedTitle({ crumbs }: { crumbs: Crumb[] }) {
  const resolvedCrumbs = crumbs.map((crumb) =>
    typeof crumb === "string" ? crumb : use(crumb)
  );
  return <Title crumbs={resolvedCrumbs} />;
}

/** The deepest crumb first, so the tab reads as the page before its section. */
function Title({ crumbs }: { crumbs: string[] }) {
  return <title>{[...crumbs].reverse().join(" - ") || "Phoenix"}</title>;
}
