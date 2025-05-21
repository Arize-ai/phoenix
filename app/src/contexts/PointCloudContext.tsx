import { createContext, PropsWithChildren, useContext, useState } from "react";
import { useZustand } from "use-zustand";

import {
  createPointCloudStore,
  PointCloudProps,
  PointCloudState,
  PointCloudStore,
} from "@phoenix/store/pointCloudStore";

export const PointCloudContext = createContext<PointCloudStore | null>(null);

export function PointCloudProvider({
  children,
  ...props
}: PropsWithChildren<Partial<PointCloudProps>>) {
  const [store] = useState<PointCloudStore>(() => createPointCloudStore(props));

  return (
    <PointCloudContext.Provider value={store}>
      {children}
    </PointCloudContext.Provider>
  );
}

export function usePointCloudContext<T>(
  selector: (state: PointCloudState) => T,
  equalityFn?: (left: T, right: T) => boolean
): T {
  const store = useContext(PointCloudContext);
  if (!store) throw new Error("Missing PointCloudContext.Provider in the tree");
  return useZustand(store, selector, equalityFn);
}
