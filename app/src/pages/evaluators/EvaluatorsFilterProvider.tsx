import {
  createContext,
  Dispatch,
  PropsWithChildren,
  SetStateAction,
  useContext,
  useState,
} from "react";
import invariant from "tiny-invariant";

import { EvaluatorSort } from "@phoenix/pages/evaluators/__generated__/EvaluatorsTableEvaluatorsQuery.graphql";

export type EvaluatorsFilterContext = {
  filter: string;
  setFilter: Dispatch<SetStateAction<string>>;
  selectedEvaluatorIds: string[];
  setSelectedEvaluatorIds: Dispatch<SetStateAction<string[]>>;
  sort: EvaluatorSort | null | undefined;
  setSort: Dispatch<SetStateAction<EvaluatorSort | null | undefined>>;
};

export const evaluatorsFilterContext =
  createContext<EvaluatorsFilterContext | null>(null);

export const EvaluatorsFilterProvider = ({ children }: PropsWithChildren) => {
  const [filter, setFilter] = useState("");
  const [selectedEvaluatorIds, setSelectedEvaluatorIds] = useState<string[]>(
    []
  );
  const [sort, setSort] = useState<EvaluatorSort | null | undefined>(undefined);
  return (
    <evaluatorsFilterContext.Provider
      value={{
        selectedEvaluatorIds,
        setSelectedEvaluatorIds,
        filter,
        setFilter,
        sort,
        setSort,
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
