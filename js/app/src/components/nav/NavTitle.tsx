import { useMemo } from "react";

import { useMatchesWithCrumb } from "@phoenix/hooks/useMatchesWithCrumb";

export function NavTitle() {
  const matchesWithCrumb = useMatchesWithCrumb();

  const titleText = useMemo(
    () =>
      matchesWithCrumb
        .map((match) => match.handle.crumb(match.loaderData))
        .reverse()
        .join(" - ") || "Phoenix",
    [matchesWithCrumb]
  );
  return <title>{titleText}</title>;
}
