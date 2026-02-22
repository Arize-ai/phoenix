import type { ReactNode } from "react";

import type { ViewProps } from "@phoenix/components";
import { View } from "@phoenix/components";

export function CodeWrap({
  children,
  ...props
}: { children: ReactNode } & ViewProps) {
  return (
    <View
      borderColor="light"
      borderWidth="thin"
      borderRadius="small"
      {...props}
    >
      {children}
    </View>
  );
}
