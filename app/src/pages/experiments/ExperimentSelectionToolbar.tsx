import React, { ReactNode, useState } from "react";
import { useNavigate } from "react-router";
import { css } from "@emotion/react";

import { Button, DialogContainer, Flex, Text, View } from "@arizeai/components";

interface SelectedExperiment {
  id: string;
}

type ExperimentSelectionToolbarProps = {
  datasetId: string;
  selectedExperiments: SelectedExperiment[];
  onClearSelection: () => void;
};

export function ExperimentSelectionToolbar(
  props: ExperimentSelectionToolbarProps
) {
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<ReactNode>(null);
  const { datasetId, selectedExperiments, onClearSelection } = props;

  const isPlural = selectedExperiments.length !== 1;

  return (
    <div
      css={css`
        position: absolute;
        bottom: var(--ac-global-dimension-size-400);
        left: 50%;
        transform: translateX(-50%);
      `}
    >
      <View
        backgroundColor="light"
        padding="size-200"
        borderColor="light"
        borderWidth="thin"
        borderRadius="medium"
        minWidth="size-6000"
      >
        <Flex
          direction="row"
          justifyContent="space-between"
          alignItems="center"
        >
          <Text>{`${selectedExperiments.length} experiment${isPlural ? "s" : ""} selected`}</Text>
          <Flex direction="row" gap="size-100">
            <Button variant="default" size="compact" onClick={onClearSelection}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="compact"
              onClick={() => {
                navigate(
                  `/datasets/${datasetId}/compare?${selectedExperiments.map((experiment) => `experimentId=${experiment.id}`).join("&")}`
                );
              }}
            >
              Compare Experiments
            </Button>
          </Flex>
        </Flex>
      </View>
      <DialogContainer
        onDismiss={() => {
          setDialog(null);
        }}
      >
        {dialog}
      </DialogContainer>
    </div>
  );
}
