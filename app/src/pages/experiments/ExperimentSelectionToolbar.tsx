import { useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";
import { useNavigate } from "react-router";

import {
  Button,
  Dialog,
  Flex,
  Group,
  Icon,
  IconButton,
  Icons,
  Modal,
  ModalOverlay,
  Text,
  Toolbar,
  View,
} from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";
import { FloatingToolbarContainer } from "@phoenix/components/toolbar/FloatingToolbarContainer";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

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
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
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

  const handleDelete = useCallback(() => {
    deleteExperiments({
      variables: {
        input: {
          experimentIds: selectedExperiments.map((experiment) => experiment.id),
        },
      },
      onCompleted: () => {
        notifySuccess({
          title: "Experiments Deleted",
          message: `${selectedExperiments.length} experiment${isPlural ? "s" : ""} have been deleted.`,
        });
        // Clear the selection
        onExperimentsDeleted();
        onClearSelection();
        setIsDeleteDialogOpen(false);
      },
      onError: (error) => {
        const formattedError = getErrorMessagesFromRelayMutationError(error);
        notifyError({
          title: "An error occurred",
          message: `Failed to delete experiments: ${formattedError?.[0] ?? error.message}`,
        });
        setIsDeleteDialogOpen(false);
      },
    });
  }, [
    deleteExperiments,
    isPlural,
    notifyError,
    notifySuccess,
    onClearSelection,
    onExperimentsDeleted,
    selectedExperiments,
  ]);

  const onPressDelete = useCallback(() => {
    setIsDeleteDialogOpen(true);
  }, []);

  return (
    <FloatingToolbarContainer>
      <Toolbar aria-label="Experiment selection">
        <Group aria-label="Experiment selection">
          <View paddingEnd="size-100">
            <Flex direction="row" gap="size-100" alignItems="center">
              <IconButton
                size="S"
                onPress={onClearSelection}
                aria-label="Clear selection"
              >
                <Icon svg={<Icons.CloseOutline />} />
              </IconButton>
              <Text>{`${selectedExperiments.length} experiment${isPlural ? "s" : ""} selected`}</Text>
            </Flex>
          </View>
          <Button
            variant="primary"
            size="M"
            onPress={() => {
              const baseExperimentId =
                selectedExperiments[selectedExperiments.length - 1].id; // treat the oldest experiment as the base experiment
              const compareExperimentIds = selectedExperiments
                .slice(0, -1)
                .map((exp) => exp.id);
              const experimentIds = [baseExperimentId, ...compareExperimentIds];
              const queryParams = `?${experimentIds.map((id) => `experimentId=${id}`).join("&")}`;
              navigate(`/datasets/${datasetId}/compare${queryParams}`);
            }}
            leadingVisual={<Icon svg={<Icons.ArrowCompareOutline />} />}
          >
            Compare
          </Button>
          <Button
            variant="danger"
            size="M"
            leadingVisual={
              <Icon
                svg={
                  isDeletingExperiments ? (
                    <Icons.LoadingOutline />
                  ) : (
                    <Icons.TrashOutline />
                  )
                }
              />
            }
            isDisabled={isDeletingExperiments}
            onPress={onPressDelete}
            aria-label="Delete Experiments"
          />
        </Group>
      </Toolbar>
      <ModalOverlay
        isDismissable
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <Modal size="S">
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Experiments</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton slot="close" />
                </DialogTitleExtra>
              </DialogHeader>
              <View padding="size-200">
                <Text color="danger">
                  {`Are you sure you want to delete these experiments? This will also delete all associated annotations and traces, and it cannot be undone.`}
                </Text>
              </View>
              <View
                paddingEnd="size-200"
                paddingTop="size-100"
                paddingBottom="size-100"
                borderTopColor="light"
                borderTopWidth="thin"
              >
                <Flex direction="row" justifyContent="end" gap="size-100">
                  <Button size="S" onPress={() => setIsDeleteDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="S"
                    onPress={handleDelete}
                    isDisabled={isDeletingExperiments}
                  >
                    Delete
                  </Button>
                </Flex>
              </View>
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </FloatingToolbarContainer>
  );
}
