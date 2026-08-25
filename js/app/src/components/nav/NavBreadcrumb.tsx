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
  const { search } = useLocation();
  const numMatches = matchesWithCrumb.length;
  return (
    <Breadcrumbs size="L">
      {matchesWithCrumb.map((match, index) => {
        const crumb = match.handle.crumb(match.loaderData);
        const copyableItems = match.handle.copy
          ? match.handle?.copy(match.loaderData)
          : [];
        const nextMatch = matchesWithCrumb[index + 1];
        const breadcrumbDestination =
          nextMatch?.handle.parentCrumbTo?.({
            parentPathname: match.pathname,
            search,
          }) ?? match.pathname;
        const isLastCrumb = index === numMatches - 1;
        const showCopyableItems = isLastCrumb && copyableItems.length;
        return (
          <Breadcrumb key={index}>
            <Flex direction="row" gap="size-100">
              <Link to={breadcrumbDestination} title={crumb}>
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
