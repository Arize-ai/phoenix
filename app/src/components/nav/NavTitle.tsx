import { useMemo } from "react";

import { useMatchesWithCrumb } from "@phoenix/hooks/useMatchesWithCrumb";

export function NavTitle() {
  const matchesWithCrumb = useMatchesWithCrumb();

  const titleText = useMemo(
    () =>
      matchesWithCrumb
        .reverse()
        .map((match) => match.handle.crumb(match.loaderData))
        .join(" - ") || "Phoenix",
    [matchesWithCrumb]
  );
  return <title>{titleText}</title>;
}
