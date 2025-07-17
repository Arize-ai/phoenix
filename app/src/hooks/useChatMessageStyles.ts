import { useMemo } from "react";

import { ViewStyleProps } from "@phoenix/components/types";
import { ChatRoleMap } from "@phoenix/constants/generativeConstants";

export function useChatMessageStyles(
  role: string
): Pick<ViewStyleProps, "backgroundColor" | "borderColor"> {
  return useMemo<ViewStyleProps>(() => {
    const normalizedRole = role.toLowerCase();
    if (ChatRoleMap.user.includes(normalizedRole)) {
      return {
        backgroundColor: "grey-200",
        borderColor: "grey-500",
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
      backgroundColor: "grey-100",
      borderColor: "grey-700",
    };
  }, [role]);
}
