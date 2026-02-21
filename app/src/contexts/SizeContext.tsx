import type { ReactNode } from "react";
import { createContext, useContext } from "react";

import type { ComponentSize } from "@phoenix/components/types";

interface SizeContextType {
  size: ComponentSize;
}

const SizeContext = createContext<SizeContextType>({
  size: "M",
});

export function SizeProvider({
  size = "M",
  children,
}: {
  size?: ComponentSize;
  children: ReactNode;
}) {
  return (
    <SizeContext.Provider value={{ size }}>{children}</SizeContext.Provider>
  );
}

export function useSize() {
  const context = useContext(SizeContext);
  return context.size;
}
