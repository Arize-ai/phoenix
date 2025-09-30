import { createContext, useContext } from "react";
import { useZustand } from "use-zustand";

import {
  PointCloudState,
  PointCloudStore,
} from "@phoenix/store/pointCloudStore";

export const PointCloudContext = createContext<PointCloudStore | null>(null);

export function usePointCloudContext<T>(
  selector: (state: PointCloudState) => T,
  equalityFn?: (left: T, right: T) => boolean
): T {
  const store = useContext(PointCloudContext);
  if (!store) throw new Error("Missing PointCloudContext.Provider in the tree");
  return useZustand(store, selector, equalityFn);
}
