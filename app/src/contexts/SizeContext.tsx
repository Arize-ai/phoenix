import { createContext, ReactNode, useContext } from "react";

import { ComponentSize } from "@phoenix/components/types";

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
