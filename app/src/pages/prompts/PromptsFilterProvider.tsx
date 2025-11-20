import {
  createContext,
  Dispatch,
  PropsWithChildren,
  SetStateAction,
  useContext,
  useState,
} from "react";

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
  const [selectedPromptLabelIds, setSelectedPromptLabelIds] = useState<
    string[]
  >([]);
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
