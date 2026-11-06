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
  // Keyed by the path for the reason NavBreadcrumb gives: a boundary already
  // on screen would hold the navigation until every name arrived. Until then
  // the title is made of the crumbs already known.
  return (
    <Suspense
      key={pathname}
      fallback={
        <Title crumbs={crumbs.filter((crumb) => typeof crumb === "string")} />
      }
    >
      <ResolvedTitle crumbs={crumbs} />
    </Suspense>
  );
}

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
