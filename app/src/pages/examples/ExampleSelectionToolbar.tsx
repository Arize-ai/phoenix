import { ReactNode, useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";
import { css } from "@emotion/react";

import { DialogContainer } from "@arizeai/components";

import {
  Button,
  Flex,
  Icon,
  IconButton,
  Icons,
  Text,
  Tooltip,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import { FloatingToolbarContainer } from "@phoenix/components/toolbar/FloatingToolbarContainer";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { useDatasetContext } from "@phoenix/contexts/DatasetContext";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

interface SelectedExample {
  id: string;
}

type ExampleSelectionToolbarProps = {
  selectedExamples: SelectedExample[];
  onClearSelection: () => void;
  onExamplesDeleted: () => void;
};

export function ExampleSelectionToolbar(props: ExampleSelectionToolbarProps) {
  const refreshLatestVersion = useDatasetContext(
    (state) => state.refreshLatestVersion
  );
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
        // Notify the dataset store to refresh the latest version
        refreshLatestVersion();
      },
      onError: (error) => {
        const formattedError = getErrorMessagesFromRelayMutationError(error);
        notifyError({
          title: "An error occurred",
          message: `Failed to delete examples: ${formattedError?.[0] ?? error.message}`,
        });
      },
    });
  }, [
    deleteExamples,
    selectedExamples,
    notifySuccess,
    isPlural,
    onExamplesDeleted,
    onClearSelection,
    refreshLatestVersion,
    notifyError,
  ]);
  return (
    <FloatingToolbarContainer>
      <Flex direction="row" justifyContent="space-between" alignItems="center">
        <View minWidth={300}>
          <Flex direction="row" gap="size-100" alignItems="center">
            <TooltipTrigger>
              <IconButton
                size="S"
                onPress={onClearSelection}
                aria-label="Clear selection"
              >
                <Icon svg={<Icons.CloseOutline />} />
              </IconButton>
              <Tooltip>Clear selection</Tooltip>
            </TooltipTrigger>
            <Text>{`${selectedExamples.length} example${isPlural ? "s" : ""} selected`}</Text>
          </Flex>
        </View>
        <Flex direction="row" gap="size-100">
          <Button
            variant="danger"
            size="S"
            leadingVisual={
              <Icon
                svg={
                  isDeletingExamples ? (
                    <Icons.LoadingOutline />
                  ) : (
                    <Icons.TrashOutline />
                  )
                }
              />
            }
            isDisabled={isDeletingExamples}
            onPress={onDeleteExamples}
            aria-label="Delete Examples"
          />
        </Flex>
      </Flex>
      <DialogContainer
        onDismiss={() => {
          setDialog(null);
        }}
      >
        {dialog}
      </DialogContainer>
    </FloatingToolbarContainer>
  );
}
