import { Link } from "react-router";

import {
  Breadcrumb,
  Breadcrumbs,
  CopyActionMenu,
  Flex,
} from "@phoenix/components";
import { useMatchesWithCrumb } from "@phoenix/hooks/useMatchesWithCrumb";

export function NavBreadcrumb() {
  const matchesWithCrumb = useMatchesWithCrumb();
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
              <Link to={match.pathname} title={crumb}>
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
