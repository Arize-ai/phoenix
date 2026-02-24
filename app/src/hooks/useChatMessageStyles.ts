import { useMemo } from "react";

import type { ViewStyleProps } from "@phoenix/components/types";
import { ChatRoleMap } from "@phoenix/constants/generativeConstants";

export function useChatMessageStyles(
  role: string
): Pick<ViewStyleProps, "backgroundColor" | "borderColor"> {
  return useMemo<ViewStyleProps>(() => {
    const normalizedRole = role.toLowerCase();
    if (ChatRoleMap.user.includes(normalizedRole)) {
      return {
        backgroundColor: "gray-200",
        borderColor: "gray-500",
      };
    } else if (ChatRoleMap.ai.includes(normalizedRole)) {
      return {
        backgroundColor: "blue-100",
        borderColor: "blue-700",
      };
    } else if (ChatRoleMap.system.includes(normalizedRole)) {
      return {
        backgroundColor: "indigo-100",
        borderColor: "indigo-700",
      };
    } else if (["function", "tool"].includes(normalizedRole)) {
      return {
        backgroundColor: "yellow-100",
        borderColor: "yellow-700",
      };
    }
    return {
      backgroundColor: "gray-100",
      borderColor: "gray-700",
    };
  }, [role]);
}
