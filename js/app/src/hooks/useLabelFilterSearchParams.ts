import type { Dispatch, SetStateAction } from "react";
import { useCallback, useMemo } from "react";
import { useSearchParams } from "react-router";

import { LABEL_ID_PARAM } from "@phoenix/constants/searchParams";

/**
 * Backs a label-id filter selection with the URL search params so the filter is
 * shareable and survives reloads. Label ids are stored as repeated `labelId`
 * query params (e.g. `?labelId=a&labelId=b`).
 *
 * Returns a `[selectedLabelIds, setSelectedLabelIds]` tuple with the same shape
 * as `useState<string[]>`, so it can be dropped in wherever local label-filter
 * state was previously held.
 */
export function useLabelFilterSearchParams(): [
  string[],
  Dispatch<SetStateAction<string[]>>,
] {
  const [searchParams, setSearchParams] = useSearchParams();

  const selectedLabelIds = useMemo(
    () => searchParams.getAll(LABEL_ID_PARAM),
    [searchParams]
  );

  const setSelectedLabelIds = useCallback<Dispatch<SetStateAction<string[]>>>(
    (action) => {
      setSearchParams(
        (prev) => {
          const current = prev.getAll(LABEL_ID_PARAM);
          const next = typeof action === "function" ? action(current) : action;
          const newParams = new URLSearchParams(prev);
          newParams.delete(LABEL_ID_PARAM);
          next.forEach((id) => newParams.append(LABEL_ID_PARAM, id));
          return newParams;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  return [selectedLabelIds, setSelectedLabelIds];
}
