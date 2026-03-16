import { Link } from "react-router";

import { Breadcrumb, Breadcrumbs } from "@phoenix/components";
import { useMatchesWithCrumb } from "@phoenix/hooks/useMatchesWithCrumb";

import { NavCopyActionMenu } from "./NavCopyActionMenu";

export function NavBreadcrumb() {
  const matchesWithCrumb = useMatchesWithCrumb();
  return (
    <Breadcrumbs size="L">
      {matchesWithCrumb.map((match, index) => {
        const crumb = match.handle.crumb(match.loaderData);
        const copyableItems = match.handle.copy
          ? match.handle?.copy(match.loaderData)
          : [];
        const showCopyableItems = copyableItems.length > 0;
        return (
          <Breadcrumb key={index}>
            <Link to={match.pathname} title={crumb}>
              {crumb}
            </Link>
            {showCopyableItems ? (
              <NavCopyActionMenu items={copyableItems} />
            ) : null}
          </Breadcrumb>
        );
      })}
    </Breadcrumbs>
  );
}
