import React, { ReactNode, useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";
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

interface SelectedExample {
  id: string;
}

type ExampleSelectionToolbarProps = {
  selectedExamples: SelectedExample[];
  onClearSelection: () => void;
  onExamplesDeleted: () => void;
};

export function ExampleSelectionToolbar(props: ExampleSelectionToolbarProps) {
  const { selectedExamples, onExamplesDeleted, onClearSelection } = props;
  const [dialog, setDialog] = useState<ReactNode>(null);
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  const [deleteExamples, isDeletingExamples] = useMutation(graphql`
    mutation ExampleSelectionToolbarDeleteExamplesMutation(
      $input: DeleteDatasetExamplesInput!
    ) {
      deleteDatasetExamples(input: $input) {
        dataset {
          id
        }
      }
    }
  `);
  const isPlural = selectedExamples.length !== 1;
  const onDeleteExamples = useCallback(() => {
    deleteExamples({
      variables: {
        input: {
          exampleIds: selectedExamples.map((example) => example.id),
        },
      },
      onCompleted: () => {
        notifySuccess({
          title: "Examples Deleted",
          message: `${selectedExamples.length} example${isPlural ? "s" : ""} have been deleted.`,
        });
        // Clear the selection
        onExamplesDeleted();
        onClearSelection();
      },
      onError: (error) => {
        notifyError({
          title: "An error occurred",
          message: `Failed to delete examples: ${error.message}`,
        });
      },
    });
  }, [
    deleteExamples,
    selectedExamples,
    notifySuccess,
    isPlural,
    onClearSelection,
    notifyError,
  ]);
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
          <Text>{`${selectedExamples.length} example${isPlural ? "s" : ""} selected`}</Text>
          <Flex direction="row" gap="size-100">
            <Button variant="default" size="compact" onClick={onClearSelection}>
              Cancel
            </Button>

            <Button
              variant="danger"
              size="compact"
              icon={<Icon svg={<Icons.TrashOutline />} />}
              loading={isDeletingExamples}
              disabled={isDeletingExamples}
              onClick={onDeleteExamples}
            >
              {isDeletingExamples
                ? "Deleting..."
                : "Delete Example" + (isPlural ? "s" : "")}
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
