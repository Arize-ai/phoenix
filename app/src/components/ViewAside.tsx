import React, { PropsWithChildren } from "react";

import { View } from "@arizeai/components";

export function ViewAside(props: PropsWithChildren) {
  return (
    <View
      width="size-1250"
      backgroundColor="gray-700"
      borderStartWidth="thin"
      borderStartColor="dark"
      padding="size-200"
    >
      {props.children}
    </View>
  );
}
