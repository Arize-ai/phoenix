import type { PropsWithChildren } from "react";
import { createContext, startTransition, useContext, useState } from "react";

type CollapsibleContentContextValue = {
  actionVersion: number;
  collapseAll: () => void;
  expandAll: () => void;
  expansionAction: "collapse" | "expand" | null;
  isCollapsed: boolean;
};

const DEFAULT_COLLAPSIBLE_CONTENT_CONTEXT: CollapsibleContentContextValue = {
  actionVersion: 0,
  collapseAll: () => undefined,
  expandAll: () => undefined,
  expansionAction: null,
  isCollapsed: false,
};

const CollapsibleContentContext = createContext<CollapsibleContentContextValue>(
  DEFAULT_COLLAPSIBLE_CONTENT_CONTEXT
);

/**
 * Scopes a collapse-all action to the collapsible content rendered beneath it.
 */
export function CollapsibleContentProvider({ children }: PropsWithChildren) {
  const [expansionState, setExpansionState] = useState<{
    action: "collapse" | "expand" | null;
    version: number;
  }>({ action: null, version: 0 });

  const collapseAll = () => {
    startTransition(() => {
      setExpansionState((currentState) => ({
        action: "collapse",
        version: currentState.version + 1,
      }));
    });
  };

  const expandAll = () => {
    startTransition(() => {
      setExpansionState((currentState) => ({
        action: "expand",
        version: currentState.version + 1,
      }));
    });
  };

  return (
    <CollapsibleContentContext.Provider
      value={{
        actionVersion: expansionState.version,
        collapseAll,
        expandAll,
        expansionAction: expansionState.action,
        isCollapsed: expansionState.action === "collapse",
      }}
    >
      {children}
    </CollapsibleContentContext.Provider>
  );
}

export function useCollapsibleContent() {
  return useContext(CollapsibleContentContext);
}
