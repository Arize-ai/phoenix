import { useMatches, useNavigate } from "react-router";

import { Breadcrumb, Breadcrumbs } from "@phoenix/components";

export type CrumbFn = (data: unknown) => string;
type Matches = ReturnType<typeof useMatches>;
type Match = Matches[number];
type RouteMatchWithCrumb = Match & {
  handle: {
    crumb: CrumbFn;
  };
};

function isRouteMatchWithCrumb(match: Match): match is RouteMatchWithCrumb {
  return (
    typeof match.handle == "object" &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (match.handle as any)?.crumb === "function"
  );
}

export function NavBreadcrumb() {
  const navigate = useNavigate();
  const matches = useMatches();
  // Get rid of any matches that don't have handle and crumb
  const matchesWithCrumb = matches.filter(isRouteMatchWithCrumb);

  return (
    <Breadcrumbs>
      {matchesWithCrumb.map((match, index) => {
        const isLast = index === matchesWithCrumb.length - 1;
        return (
          <Breadcrumb
            key={index}
            href={isLast ? undefined : match.pathname}
            onPress={isLast ? undefined : () => navigate(match.pathname)}
            isCurrent={isLast}
          >
            {match.handle.crumb(match.data)}
          </Breadcrumb>
        );
      })}
    </Breadcrumbs>
  );
}
