import { Link, useLocation } from "react-router";

import {
  Breadcrumb,
  Breadcrumbs,
  CopyActionMenu,
  Flex,
} from "@phoenix/components";
import { useMatchesWithCrumb } from "@phoenix/hooks/useMatchesWithCrumb";

export function NavBreadcrumb() {
  const matchesWithCrumb = useMatchesWithCrumb();
  // Crumbs deliberately reset the search, but the fragment carries the span
  // filter, and dropping it silently clears a filter the user is looking at.
  const { hash } = useLocation();
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
              <Link to={{ pathname: match.pathname, hash }} title={crumb}>
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
