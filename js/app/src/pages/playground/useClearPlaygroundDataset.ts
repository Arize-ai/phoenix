import { useSearchParams } from "react-router";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";

/**
 * Clear the loaded dataset from the playground store and from the URL, which
 * is what the dataset picker's clear button does. Shared so other surfaces
 * that must drop the dataset (choosing a decision model) leave the page in
 * the same state the picker would.
 */
export function useClearPlaygroundDataset(): () => void {
  const setDatasetId = usePlaygroundContext((state) => state.setDatasetId);
  const [, setSearchParams] = useSearchParams();
  return () => {
    setDatasetId(null);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("datasetId");
      next.delete("splitId");
      next.delete("exampleId");
      return next;
    });
  };
}
