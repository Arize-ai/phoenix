import type { Dispatch, PropsWithChildren, SetStateAction } from "react";
import { createContext, useContext, useState } from "react";

import { useLabelFilterSearchParams, usePersistedState } from "@phoenix/hooks";

export type PromptsFilterContext = {
  filter: string;
  setFilter: Dispatch<SetStateAction<string>>;
  selectedPromptLabelIds: string[];
  setSelectedPromptLabelIds: Dispatch<SetStateAction<string[]>>;
  columnVisibility: Record<string, boolean>;
  setColumnVisibility: Dispatch<SetStateAction<Record<string, boolean>>>;
  columnSizing: Record<string, number>;
  setColumnSizing: Dispatch<SetStateAction<Record<string, number>>>;
  columnOrder: string[];
  setColumnOrder: Dispatch<SetStateAction<string[]>>;
};

export const promptsFilterContext = createContext<PromptsFilterContext | null>(
  null
);

export const PromptsFilterProvider = ({ children }: PropsWithChildren) => {
  const [filter, setFilter] = useState("");
  // The label filter is persisted to the URL so it can be shared and survive
  // reloads.
  const [selectedPromptLabelIds, setSelectedPromptLabelIds] =
    useLabelFilterSearchParams();
  const [columnVisibility, setColumnVisibility] = usePersistedState<
    Record<string, boolean>
  >("phoenix-prompts-column-visibility:v1", {});
  const [columnSizing, setColumnSizing] = usePersistedState<
    Record<string, number>
  >("phoenix-prompts-column-sizing:v1", {});
  const [columnOrder, setColumnOrder] = usePersistedState<string[]>(
    "phoenix-prompts-column-order:v1",
    []
  );
  return (
    <promptsFilterContext.Provider
      value={{
        selectedPromptLabelIds,
        setSelectedPromptLabelIds,
        filter,
        setFilter,
        columnVisibility,
        setColumnVisibility,
        columnSizing,
        setColumnSizing,
        columnOrder,
        setColumnOrder,
      }}
    >
      {children}
    </promptsFilterContext.Provider>
  );
};

export const usePromptsFilterContext = () => {
  const context = useContext(promptsFilterContext);
  if (context === null) {
    throw new Error(
      "usePromptsFilterContext must be used within PromptsFilterProvider"
    );
  }
  return context;
};
