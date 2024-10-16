import React, { ReactNode } from "react";

import { View, ViewStyleProps } from "@arizeai/components";

export function CodeWrap({
  children,
  ...props
}: { children: ReactNode } & ViewStyleProps) {
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
