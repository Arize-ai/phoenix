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

const isLoadingCrumb = ({ crumb }: CrumbEntry) => typeof crumb !== "string";

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
  const hasLoadingCrumb = entries.some(isLoadingCrumb);
  if (!hasLoadingCrumb) {
    return <BreadcrumbTrail entries={entries} />;
  }
  // Keyed so each navigation mounts a fresh boundary: the router navigates
  // in a transition, which holds an already-mounted boundary until it loads.
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
        const isCrumbLoading = typeof crumb !== "string";
        const isLastCrumb = index === numEntries - 1;
        const showCopyableItems = isLastCrumb && copyableItems.length > 0;
        return (
          <Breadcrumb key={key}>
            <Flex direction="row" gap="size-100" alignItems="center">
              {isCrumbLoading ? (
                <Skeleton
                  width={PENDING_CRUMB_WIDTH}
                  height="1em"
                  role="status"
                  aria-label="loading"
                />
              ) : (
                <Link to={to} title={crumb}>
                  {crumb}
                </Link>
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
