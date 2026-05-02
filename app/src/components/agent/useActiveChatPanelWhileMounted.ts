import { useEffect } from "react";

import { useAgentContext } from "@phoenix/contexts/AgentContext";
import type { AgentPanelLocation } from "@phoenix/store/agentStore";

/**
 * Claims the given panel location in the agent store for the lifetime of the
 * calling component. On unmount the location is released back to `"docked"`.
 *
 * This lets the Layout know which surface currently hosts the agent chat so it
 * can suppress the docked panel when another surface (e.g. trace slideover)
 * is active.
 */
export function useActiveChatPanelWhileMounted(location: AgentPanelLocation) {
  const setActivePanelLocation = useAgentContext(
    (s) => s.setActivePanelLocation
  );

  useEffect(() => {
    setActivePanelLocation(location);
    return () => {
      setActivePanelLocation("docked");
    };
  }, [location, setActivePanelLocation]);
}
