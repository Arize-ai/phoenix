import React, { ReactNode } from "react";

type DatasetDef = {
  name: string;
};

type DatasetsContextType = {
  primaryDataset: DatasetDef;
  referenceDataset: DatasetDef;
};

export const DatasetsContext = React.createContext<DatasetsContextType | null>(
  null
);

export function useDatasets() {
  const context = React.useContext(DatasetsContext);
  if (context === null) {
    throw new Error("useDatasets must be used within a DatasetsProvider");
  }
  return context;
}

type DatasetsProviderProps = {
  primaryDataset: DatasetDef;
  referenceDataset: DatasetDef;
  children: ReactNode;
};

export function DatasetsProvider(props: DatasetsProviderProps) {
  return (
    <DatasetsContext.Provider
      value={{
        primaryDataset: props.primaryDataset,
        referenceDataset: props.referenceDataset,
      }}
    >
      {props.children}
    </DatasetsContext.Provider>
  );
}
