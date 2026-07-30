import { Link, useLocation } from "react-router";

import {
  Breadcrumb,
  Breadcrumbs,
  CopyActionMenu,
  Flex,
} from "@phoenix/components";
import { useMatchesWithCrumb } from "@phoenix/hooks/useMatchesWithCrumb";
import { retainScopedFragmentState } from "@phoenix/utils/scopedFragmentState";

export function NavBreadcrumb() {
  const matchesWithCrumb = useMatchesWithCrumb();
  // Crumbs deliberately reset the search, but the fragment carries scoped view
  // state (the span filter), and dropping it silently clears a filter the user
  // is looking at. It is carried only while the crumb stays inside the scope
  // that consumes it -- a crumb that leaves the project (or evaluator) strips
  // the filter rather than ferrying it onto pages that cannot use it.
  const { hash, pathname } = useLocation();
  const numMatches = matchesWithCrumb.length;
  return (
    <Breadcrumbs size="L">
      {matchesWithCrumb.map((match, index) => {
        const crumb = match.handle.crumb(match.loaderData);
        const copyableItems = match.handle.copy
          ? match.handle?.copy(match.loaderData)
          : [];
        const isLastCrumb = index === numMatches - 1;
        const showCopyableItems = isLastCrumb && copyableItems.length;
        return (
          <Breadcrumb key={index}>
            <Flex direction="row" gap="size-100">
              <Link
                to={{
                  pathname: match.pathname,
                  hash: retainScopedFragmentState({
                    hash,
                    fromPathname: pathname,
                    toPathname: match.pathname,
                  }),
                }}
                title={crumb}
              >
                {crumb}
              </Link>
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
