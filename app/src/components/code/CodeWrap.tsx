import React, { ReactNode } from "react";

import { View } from "@arizeai/components";

export function CodeWrap({ children }: { children: ReactNode }) {
  return (
    <View borderColor="light" borderWidth="thin" borderRadius="small">
      {children}
    </View>
  );
}
