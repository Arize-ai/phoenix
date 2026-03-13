import { useMatches } from "react-router";

export type CrumbFn = (data: unknown) => string;
export type CopyItem = { name: string, value: string };
export type CopyFn = (data: unknown) => CopyItem[];
type Matches = ReturnType<typeof useMatches>;
type Match = Matches[number];
type RouteMatchWithCrumb = Match & {
  handle: {
    crumb: CrumbFn;
    copy?: CopyFn;
  };
};

function isRouteMatchWithCrumb(match: Match): match is RouteMatchWithCrumb {
  return (
    typeof match.handle == "object" &&
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    typeof (match.handle as any)?.crumb === "function"
  );
}

/**
 * Returns the matches with crumb function.
 * @returns The matches with crumb function.
 */
export const useMatchesWithCrumb = () => {
  const matches = useMatches();
  // Get rid of any matches that don't have handle and crumb
  const matchesWithCrumb = matches.filter(isRouteMatchWithCrumb);
  return matchesWithCrumb;
};
