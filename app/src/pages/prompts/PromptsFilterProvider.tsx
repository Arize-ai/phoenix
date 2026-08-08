import type { Dispatch, PropsWithChildren, SetStateAction } from "react";
import { createContext, useContext, useState } from "react";

import { useLabelFilterSearchParams } from "@phoenix/hooks";

export type PromptsFilterContext = {
  filter: string;
  setFilter: Dispatch<SetStateAction<string>>;
  selectedPromptLabelIds: string[];
  setSelectedPromptLabelIds: Dispatch<SetStateAction<string[]>>;
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
  return (
    <promptsFilterContext.Provider
      value={{
        selectedPromptLabelIds,
        setSelectedPromptLabelIds,
        filter,
        setFilter,
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
