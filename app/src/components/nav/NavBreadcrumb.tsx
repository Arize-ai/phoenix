import { Link } from "react-router";

import { Breadcrumb, Breadcrumbs } from "@phoenix/components";
import { useMatchesWithCrumb } from "@phoenix/hooks/useMatchesWithCrumb";

export function NavBreadcrumb() {
  const matchesWithCrumb = useMatchesWithCrumb();
  return (
    <Breadcrumbs size="L">
      {matchesWithCrumb.map((match, index) => {
        return (
          <Breadcrumb key={index}>
            <Link to={match.pathname}>
              {match.handle.crumb(match.loaderData)}
            </Link>
          </Breadcrumb>
        );
      })}
    </Breadcrumbs>
  );
}
