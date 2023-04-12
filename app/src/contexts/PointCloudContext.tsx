import React, {
  createContext,
  PropsWithChildren,
  useContext,
  useRef,
} from "react";
import { useStore } from "zustand";

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
  const storeRef = useRef<PointCloudStore>();
  if (!storeRef.current) {
    storeRef.current = createPointCloudStore(props);
  }
  return (
    <PointCloudContext.Provider value={storeRef.current}>
      {children}
    </PointCloudContext.Provider>
  );
}

export function usePointCloudContext<T>(
  selector: (state: PointCloudState) => T,
  equalityFn?: (left: T, right: T) => boolean,
): T {
  const store = useContext(PointCloudContext);
  if (!store) throw new Error("Missing PointCloudContext.Provider in the tree");
  return useStore(store, selector, equalityFn);
}
