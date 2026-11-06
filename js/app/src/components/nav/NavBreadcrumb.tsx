import { Suspense, use } from "react";
import { Link, type To, useLocation } from "react-router";

import {
  Breadcrumb,
  Breadcrumbs,
  CopyActionMenu,
  type CopyActionMenuItem,
  Flex,
  Skeleton,
} from "@phoenix/components";
import {
  type Crumb,
  useMatchesWithCrumb,
} from "@phoenix/hooks/useMatchesWithCrumb";

type CrumbEntry = {
  key: string;
  crumb: Crumb;
  copyableItems: CopyActionMenuItem[];
  to: To;
};

/** About the width of a typical name, so the crumbs after it do not jump. */
const PENDING_CRUMB_WIDTH = 120;

export function NavBreadcrumb() {
  const matchesWithCrumb = useMatchesWithCrumb();
  const { pathname, search } = useLocation();
  const entries: CrumbEntry[] = matchesWithCrumb.map((match, index) => {
    const nextMatch = matchesWithCrumb[index + 1];
    return {
      key: match.id,
      crumb: match.handle.crumb(match.loaderData),
      copyableItems: match.handle.copy
        ? match.handle.copy(match.loaderData)
        : [],
      to:
        nextMatch?.handle.parentCrumbTo?.({
          parentPathname: match.pathname,
          search,
        }) ?? match.pathname,
    };
  });
  // A trail of known names is rendered as is, so its links survive a
  // navigation and keep focus. Only a trail with a name still loading goes
  // through a boundary, keyed by the path so every navigation mounts a fresh
  // one: the router commits a navigation inside a transition, and only a
  // boundary that mounts within it shows its fallback at once. One already
  // on screen would hold the whole navigation until the name arrived.
  if (entries.every((entry) => typeof entry.crumb === "string")) {
    return <BreadcrumbTrail entries={entries} />;
  }
  return (
    <Suspense key={pathname} fallback={<BreadcrumbTrail entries={entries} />}>
      <ResolvedBreadcrumbTrail entries={entries} />
    </Suspense>
  );
}

function ResolvedBreadcrumbTrail({ entries }: { entries: CrumbEntry[] }) {
  const resolvedEntries = entries.map((entry) => ({
    ...entry,
    crumb: typeof entry.crumb === "string" ? entry.crumb : use(entry.crumb),
  }));
  return <BreadcrumbTrail entries={resolvedEntries} />;
}

/** The trail; a crumb whose name is still loading is a placeholder. */
function BreadcrumbTrail({ entries }: { entries: CrumbEntry[] }) {
  const numEntries = entries.length;
  return (
    <Breadcrumbs size="L">
      {entries.map(({ key, crumb, copyableItems, to }, index) => {
        const isLastCrumb = index === numEntries - 1;
        const showCopyableItems = isLastCrumb && copyableItems.length > 0;
        return (
          <Breadcrumb key={key}>
            <Flex direction="row" gap="size-100" alignItems="center">
              {typeof crumb === "string" ? (
                <Link to={to} title={crumb}>
                  {crumb}
                </Link>
              ) : (
                <Skeleton
                  width={PENDING_CRUMB_WIDTH}
                  height="1em"
                  role="status"
                  aria-label="loading"
                />
              )}
              {showCopyableItems ? (
                <CopyActionMenu items={copyableItems} />
              ) : null}
            </Flex>
          </Breadcrumb>
        );
      })}
    </Breadcrumbs>
  );
}
