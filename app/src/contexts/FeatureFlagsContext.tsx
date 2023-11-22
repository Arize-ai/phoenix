import React, { createContext, useState } from "react";

type FeatureFlag = "evals";
export type FeatureFlagsContextType = {
  featureFlags: Record<FeatureFlag, boolean>;
  setFeatureFlags: (featureFlags: Record<FeatureFlag, boolean>) => void;
};

export const LOCAL_STORAGE_FEATURE_FLAGS_KEY = "arize-phoenix-feature-flags";

const DEFAULT_FEATURE_FLAGS: Record<FeatureFlag, boolean> = {
  evals: false,
};

function getFeatureFlags(): Record<FeatureFlag, boolean> {
  const featureFlagsFromLocalStorage = localStorage.getItem(
    LOCAL_STORAGE_FEATURE_FLAGS_KEY
  );
  if (!featureFlagsFromLocalStorage) {
    return DEFAULT_FEATURE_FLAGS;
  }

  try {
    const parsedFeatureFlags = JSON.parse(featureFlagsFromLocalStorage);
    return Object.assign({}, DEFAULT_FEATURE_FLAGS, parsedFeatureFlags);
  } catch (e) {
    return DEFAULT_FEATURE_FLAGS;
  }
}

export const FeatureFlagsContext =
  createContext<FeatureFlagsContextType | null>(null);

export function useFeatureFlags() {
  const context = React.useContext(FeatureFlagsContext);
  if (context === null) {
    throw new Error(
      "useFeatureFlags must be used within a FeatureFlagsProvider"
    );
  }
  return context;
}

export function useFeatureFlag(featureFlag: FeatureFlag) {
  const { featureFlags } = useFeatureFlags();
  return featureFlags[featureFlag];
}

export function FeatureFlagsProvider(props: React.PropsWithChildren) {
  const [featureFlags, _setFeatureFlags] = useState<
    Record<FeatureFlag, boolean>
  >(getFeatureFlags());
  const setFeatureFlags = (featureFlags: Record<FeatureFlag, boolean>) => {
    localStorage.setItem(
      LOCAL_STORAGE_FEATURE_FLAGS_KEY,
      JSON.stringify(featureFlags)
    );
    _setFeatureFlags(featureFlags);
  };

  return (
    <FeatureFlagsContext.Provider value={{ featureFlags, setFeatureFlags }}>
      {props.children}
    </FeatureFlagsContext.Provider>
  );
}
