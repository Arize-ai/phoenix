import {
  createContext,
  Dispatch,
  PropsWithChildren,
  SetStateAction,
  useContext,
  useState,
} from "react";
import invariant from "tiny-invariant";

export type EvaluatorsFilterContext = {
  filter: string;
  setFilter: Dispatch<SetStateAction<string>>;
  selectedEvaluatorIds: string[];
  setSelectedEvaluatorIds: Dispatch<SetStateAction<string[]>>;
};

export const evaluatorsFilterContext =
  createContext<EvaluatorsFilterContext | null>(null);

export const EvaluatorsFilterProvider = ({ children }: PropsWithChildren) => {
  const [filter, setFilter] = useState("");
  const [selectedEvaluatorIds, setSelectedEvaluatorIds] = useState<string[]>(
    []
  );
  return (
    <evaluatorsFilterContext.Provider
      value={{
        selectedEvaluatorIds,
        setSelectedEvaluatorIds,
        filter,
        setFilter,
      }}
    >
      {children}
    </evaluatorsFilterContext.Provider>
  );
};

export const useEvaluatorsFilterContext = () => {
  const context = useContext(evaluatorsFilterContext);
  invariant(
    context,
    "useEvaluatorsFilterContext must be used within EvaluatorsFilterProvider"
  );
  return context;
};
