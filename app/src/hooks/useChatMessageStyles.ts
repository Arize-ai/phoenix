import { useMemo } from "react";

import { ViewStyleProps } from "@arizeai/components";

export function useChatMessageStyles(
  role: string
): Pick<ViewStyleProps, "backgroundColor" | "borderColor"> {
  return useMemo<ViewStyleProps>(() => {
    if (role === "user" || role === "human") {
      return {
        backgroundColor: "grey-100",
        borderColor: "grey-500",
      };
    } else if (role === "assistant" || role === "ai") {
      return {
        backgroundColor: "blue-100",
        borderColor: "blue-700",
      };
    } else if (role === "system") {
      return {
        backgroundColor: "indigo-100",
        borderColor: "indigo-700",
      };
    } else if (["function", "tool"].includes(role)) {
      return {
        backgroundColor: "yellow-100",
        borderColor: "yellow-700",
      };
    }
    return {
      backgroundColor: "grey-100",
      borderColor: "grey-700",
    };
  }, [role]);
}
