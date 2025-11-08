import React, { createContext, PropsWithChildren, useState } from "react";
import { useHotkeys } from "react-hotkeys-hook";

import { Dialog, Modal, ModalOverlay, Switch, View } from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";

type FeatureFlag = "evaluators";
export type FeatureFlagsContextType = {
  featureFlags: Record<FeatureFlag, boolean>;
  setFeatureFlags: (featureFlags: Record<FeatureFlag, boolean>) => void;
};

export const LOCAL_STORAGE_FEATURE_FLAGS_KEY = "arize-phoenix-feature-flags";

const DEFAULT_FEATURE_FLAGS: Record<FeatureFlag, boolean> = {
  evaluators: false,
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
  } catch (_e) {
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
  const [featureFlags, _setFeatureFlags] =
    useState<Record<FeatureFlag, boolean>>(getFeatureFlags());
  const setFeatureFlags = (featureFlags: Record<FeatureFlag, boolean>) => {
    localStorage.setItem(
      LOCAL_STORAGE_FEATURE_FLAGS_KEY,
      JSON.stringify(featureFlags)
    );
    _setFeatureFlags(featureFlags);
  };

  return (
    <FeatureFlagsContext.Provider value={{ featureFlags, setFeatureFlags }}>
      <FeatureFlagsControls>{props.children}</FeatureFlagsControls>
    </FeatureFlagsContext.Provider>
  );
}

function FeatureFlagsControls(props: PropsWithChildren) {
  const { children } = props;
  const { featureFlags, setFeatureFlags } = useFeatureFlags();
  const [showControls, setShowControls] = useState(false);
  useHotkeys("ctrl+shift+f", () => setShowControls(true));
  return (
    <>
      {children}

      <ModalOverlay isOpen={showControls} onOpenChange={setShowControls}>
        <Modal size="S">
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Feature Flags</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton slot="close" />
                </DialogTitleExtra>
              </DialogHeader>
              <View padding="size-100">
                {Object.keys(featureFlags).map((featureFlag) => (
                  <Switch
                    key={featureFlag}
                    isSelected={featureFlags[featureFlag as FeatureFlag]}
                    onChange={(isSelected) =>
                      setFeatureFlags({
                        ...featureFlags,
                        [featureFlag]: isSelected,
                      })
                    }
                  >
                    {featureFlag}
                  </Switch>
                ))}
              </View>
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </>
  );
}
