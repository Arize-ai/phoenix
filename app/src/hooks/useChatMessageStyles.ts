import { useMemo } from "react";

import type { ViewStyleProps } from "@phoenix/components/core/types";
import { ChatRoleMap } from "@phoenix/constants/generativeConstants";

export function useChatMessageStyles(
  role: string
): Pick<ViewStyleProps, "backgroundColor" | "borderColor"> {
  return useMemo<ViewStyleProps>(() => {
    const normalizedRole = role.toLowerCase();
    if (ChatRoleMap.user.includes(normalizedRole)) {
      return {
        backgroundColor: "gray-100",
        borderColor: "gray-300",
      };
    } else if (ChatRoleMap.ai.includes(normalizedRole)) {
      return {
        backgroundColor: "blue-100",
        borderColor: "blue-300",
      };
    } else if (ChatRoleMap.system.includes(normalizedRole)) {
      return {
        backgroundColor: "indigo-100",
        borderColor: "indigo-300",
      };
    } else if (["function", "tool"].includes(normalizedRole)) {
      return {
        backgroundColor: "yellow-100",
        borderColor: "yellow-300",
      };
    }
    return {
      backgroundColor: "gray-100",
      borderColor: "gray-300",
    };
  }, [role]);
}
