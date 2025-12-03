import { ReactNode } from "react";

import { View } from "@phoenix/components/view";

export function PaddedCell({ children }: { children: ReactNode }) {
  return (
    <View paddingX="size-200" paddingY="size-100">
      {children}
    </View>
  );
}
