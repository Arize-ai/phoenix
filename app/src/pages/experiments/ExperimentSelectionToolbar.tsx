import React, { ReactNode, useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";
import { useNavigate } from "react-router";
import { css } from "@emotion/react";

import {
  Button,
  DialogContainer,
  Flex,
  Icon,
  Icons,
  Text,
  View,
} from "@arizeai/components";

import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";

interface SelectedExperiment {
  id: string;
}

type ExperimentSelectionToolbarProps = {
  datasetId: string;
  selectedExperiments: SelectedExperiment[];
  onClearSelection: () => void;
  onExperimentsDeleted: () => void;
};

export function ExperimentSelectionToolbar(
  props: ExperimentSelectionToolbarProps
) {
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<ReactNode>(null);
  const [deleteExperiments, isDeletingExperiments] = useMutation(graphql`
    mutation ExperimentSelectionToolbarDeleteExperimentsMutation(
      $input: DeleteExperimentsInput!
    ) {
      deleteExperiments(input: $input) {
        __typename
      }
    }
  `);
  const {
    datasetId,
    selectedExperiments,
    onClearSelection,
    onExperimentsDeleted,
  } = props;
  const isPlural = selectedExperiments.length !== 1;
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  const onDeleteExperiments = useCallback(() => {
    deleteExperiments({
      variables: {
        input: {
          exampleIds: selectedExperiments.map((example) => example.id),
        },
      },
      onCompleted: () => {
        notifySuccess({
          title: "Examples Deleted",
          message: `${selectedExperiments.length} experiments${isPlural ? "s" : ""} have been deleted.`,
        });
        // Clear the selection
        onExperimentsDeleted();
        onClearSelection();
      },
      onError: (error) => {
        notifyError({
          title: "An error occurred",
          message: `Failed to delete examples: ${error.message}`,
        });
      },
    });
  }, []);
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
              variant="danger"
              size="compact"
              icon={<Icon svg={<Icons.TrashOutline />} />}
              loading={isDeletingExperiments}
              disabled={isDeletingExperiments}
              onClick={onDeleteExperiments}
            >
              {isDeletingExperiments
                ? "Deleting..."
                : "Delete Experiment" + (isPlural ? "s" : "")}
            </Button>
            <Button
              variant="primary"
              size="compact"
              onClick={() => {
                navigate(
                  `/datasets/${datasetId}/compare?${selectedExperiments.map((experiment) => `experimentId=${experiment.id}`).join("&")}`
                );
              }}
              icon={<Icon svg={<Icons.ArrowCompareOutline />} />}
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
