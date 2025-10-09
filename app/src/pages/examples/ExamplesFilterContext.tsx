import {
  createContext,
  Dispatch,
  PropsWithChildren,
  SetStateAction,
  useContext,
  useState,
} from "react";

export type ExamplesFilterContext = {
  filter: string;
  setFilter: Dispatch<SetStateAction<string>>;
  selectedSplitIds: string[];
  setSelectedSplitIds: Dispatch<SetStateAction<string[]>>;
  selectedExampleIds: string[];
  setSelectedExampleIds: Dispatch<SetStateAction<string[]>>;
};

export const examplesFilterContext =
  createContext<ExamplesFilterContext | null>(null);

export const ExamplesFilterProvider = ({ children }: PropsWithChildren) => {
  const [filter, setFilter] = useState("");
  const [selectedSplitIds, setSelectedSplitIds] = useState<string[]>([]);
  const [selectedExampleIds, setSelectedExampleIds] = useState<string[]>([]);
  return (
    <examplesFilterContext.Provider
      value={{
        selectedSplitIds,
        setSelectedSplitIds,
        filter,
        setFilter,
        selectedExampleIds,
        setSelectedExampleIds,
      }}
    >
      {children}
    </examplesFilterContext.Provider>
  );
};

export const useExamplesFilterContext = () => {
  const context = useContext(examplesFilterContext);
  if (context === null) {
    throw new Error(
      "useExamplesFilterContext must be used within ExamplesFilterProvider"
    );
  }
  return context;
};
