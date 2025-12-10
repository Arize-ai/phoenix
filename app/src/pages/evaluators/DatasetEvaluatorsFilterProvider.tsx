import {
  createContext,
  Dispatch,
  PropsWithChildren,
  SetStateAction,
  useContext,
  useState,
} from "react";
import invariant from "tiny-invariant";

import type { DatasetEvaluatorSort } from "@phoenix/pages/dataset/evaluators/__generated__/DatasetEvaluatorsTableEvaluatorsQuery.graphql";

export type DatasetEvaluatorsFilterContext = {
  filter: string;
  setFilter: Dispatch<SetStateAction<string>>;
  sort: DatasetEvaluatorSort | null | undefined;
  setSort: Dispatch<SetStateAction<DatasetEvaluatorSort | null | undefined>>;
};

export const datasetEvaluatorsFilterContext =
  createContext<DatasetEvaluatorsFilterContext | null>(null);

export const DatasetEvaluatorsFilterProvider = ({
  children,
}: PropsWithChildren) => {
  const [filter, setFilter] = useState("");
  const [sort, setSort] = useState<DatasetEvaluatorSort | null | undefined>(
    undefined
  );
  return (
    <datasetEvaluatorsFilterContext.Provider
      value={{
        filter,
        setFilter,
        sort,
        setSort,
      }}
    >
      {children}
    </datasetEvaluatorsFilterContext.Provider>
  );
};

export const useDatasetEvaluatorsFilterContext = () => {
  const context = useContext(datasetEvaluatorsFilterContext);
  invariant(
    context,
    "useDatasetEvaluatorsFilterContext must be used within DatasetEvaluatorsFilterProvider"
  );
  return context;
};
