import React from "react";
import { Breadcrumbs, Item } from "@arizeai/components";
import { useMatches, useNavigate } from "react-router";

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

  console.dir(matchesWithCrumb);
  return (
    <Breadcrumbs
      onAction={(index) => {
        // Action here is the index of the breadcrumb
        navigate(matchesWithCrumb[Number(index)].pathname);
      }}
    >
      {matchesWithCrumb.map((match, index) => (
        <Item key={index}>{match.handle.crumb(match.data)}</Item>
      ))}
    </Breadcrumbs>
  );
}
