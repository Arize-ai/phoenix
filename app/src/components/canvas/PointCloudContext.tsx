import React, { ReactNode, createContext, useContext, useState } from "react";

type PointCloudContextType = {
  /**
   * The IDs of the points that are currently selected.
   */
  selectedPointIds: Set<string>;
  /**
   * Sets the selected point IDs to the given value.
   */
  setSelectedPointIds: (ids: Set<string>) => void;
};

export const PointCloudContext = createContext<PointCloudContextType | null>(
  null
);

export const usePointCloud = () => {
  const context = useContext(PointCloudContext);
  if (context === null) {
    throw new Error("usePointCloud must be used within a PointCloudContext");
  }
  return context;
};

export function PointCloudProvider({ children }: { children: ReactNode }) {
  const [selectedPointIds, setSelectedPointIds] = useState<Set<string>>(
    new Set()
  );
  return (
    <PointCloudContext.Provider
      value={{ selectedPointIds, setSelectedPointIds }}
    >
      {children}
    </PointCloudContext.Provider>
  );
}
