import { useMemo } from "react";
import { useSearchParams } from "react-router";

import type { ComparedExperimentSelection } from "@phoenix/pages/dataset/metrics/types";

/**
 * The compared experiments picked in the URL's `experimentId` params, base
 * experiment first, or null when no experiment is picked. The selection keeps
 * its identity while the picked IDs are unchanged.
 */
export function useComparedExperimentSelection(): ComparedExperimentSelection | null {
  const [searchParams] = useSearchParams();
  // Matches the compare page, which treats any `experimentId` param, even an
  // empty one, as a selected base experiment
  const selectionKey = JSON.stringify(searchParams.getAll("experimentId"));
  return useMemo(() => {
    const experimentIds: string[] = JSON.parse(selectionKey);
    if (experimentIds.length === 0) {
      return null;
    }
    const [baseExperimentId, ...compareExperimentIds] = experimentIds;
    return { type: "compared", baseExperimentId, compareExperimentIds };
  }, [selectionKey]);
}
