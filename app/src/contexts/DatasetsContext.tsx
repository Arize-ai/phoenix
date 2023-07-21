import React, { createContext, ReactNode } from "react";

import { DatasetRole } from "@phoenix/types";
import { assertUnreachable } from "@phoenix/typeUtils";

type DatasetDef = {
  name: string;
  startTime: string;
  endTime: string;
};

export type DatasetsContextType = {
  primaryDataset: DatasetDef;
  referenceDataset: DatasetDef | null;
  corpusDataset: DatasetDef | null;
  getDatasetNameByRole: (role: DatasetRole) => string;
};

export const DatasetsContext = createContext<DatasetsContextType | null>(null);

export function useDatasets() {
  const context = React.useContext(DatasetsContext);
  if (context === null) {
    throw new Error("useDatasets must be used within a DatasetsProvider");
  }
  return context;
}

type DatasetsProviderProps = {
  primaryDataset: DatasetDef;
  referenceDataset: DatasetDef | null;
  corpusDataset: DatasetDef | null;
  children: ReactNode;
};

export function DatasetsProvider(props: DatasetsProviderProps) {
  return (
    <DatasetsContext.Provider
      value={{
        primaryDataset: props.primaryDataset,
        referenceDataset: props.referenceDataset,
        corpusDataset: props.corpusDataset,
        getDatasetNameByRole: (datasetRole: DatasetRole) => {
          switch (datasetRole) {
            case DatasetRole.primary:
              return props.primaryDataset.name;
            case DatasetRole.reference:
              return props.referenceDataset?.name ?? "reference";
            case DatasetRole.corpus:
              return props.corpusDataset?.name ?? "corpus";
            default:
              assertUnreachable(datasetRole);
          }
        },
      }}
    >
      {props.children}
    </DatasetsContext.Provider>
  );
}
