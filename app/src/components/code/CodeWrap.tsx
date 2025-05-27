import { ReactNode } from "react";

import { View, ViewProps } from "@phoenix/components";

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
