import { useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";
import { useNavigate } from "react-router";

import {
  Alert,
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
} from "@phoenix/components/core/dialog";
import { FloatingToolbarContainer } from "@phoenix/components/core/toolbar/FloatingToolbarContainer";
import { useSetExperimentBaseline } from "@phoenix/components/experiment/useSetExperimentBaseline";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

interface SelectedExperiment {
  id: string;
  isBaseline: boolean;
}

type ExperimentSelectionToolbarProps = {
  datasetId: string;
  selectedExperiments: SelectedExperiment[];
  onClearSelection: () => void;
  onBaselineChanged: () => void;
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
    onBaselineChanged,
    onExperimentsDeleted,
  } = props;
  const isPlural = selectedExperiments.length !== 1;
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  const { setExperimentBaseline, isSettingExperimentBaseline } =
    useSetExperimentBaseline();
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Setting a baseline only applies to a single selected experiment
  const singleSelectedExperiment =
    selectedExperiments.length === 1 ? selectedExperiments[0] : null;

  const handleToggleBaseline = useCallback(() => {
    if (!singleSelectedExperiment) {
      return;
    }
    setExperimentBaseline({
      experimentId: singleSelectedExperiment.id,
      isBaseline: singleSelectedExperiment.isBaseline,
      onCompleted: onBaselineChanged,
      onError: (message) => {
        notifyError({
          title: "Failed to update baseline",
          message,
        });
      },
    });
  }, [
    singleSelectedExperiment,
    setExperimentBaseline,
    onBaselineChanged,
    notifyError,
  ]);

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
        setDeleteError(
          `Failed to delete experiments: ${formattedError?.[0] ?? error.message}`
        );
      },
    });
  }, [
    deleteExperiments,
    isPlural,
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
                <Icon svg={<Icons.Close />} />
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
            leadingVisual={<Icon svg={<Icons.ArrowCompare />} />}
          >
            Compare
          </Button>
          {singleSelectedExperiment ? (
            <Button
              size="M"
              onPress={handleToggleBaseline}
              isDisabled={isSettingExperimentBaseline}
              leadingVisual={
                <Icon
                  svg={
                    isSettingExperimentBaseline ? (
                      <Icons.Loading />
                    ) : singleSelectedExperiment.isBaseline ? (
                      <Icons.BookmarkX />
                    ) : (
                      <Icons.BookmarkCheck />
                    )
                  }
                />
              }
            >
              {singleSelectedExperiment.isBaseline
                ? "Remove baseline"
                : "Mark as baseline"}
            </Button>
          ) : null}
          <Button
            variant="danger"
            size="M"
            leadingVisual={
              <Icon
                svg={
                  isDeletingExperiments ? <Icons.Loading /> : <Icons.Trash />
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
        onOpenChange={(open) => {
          if (open) setDeleteError(null);
          setIsDeleteDialogOpen(open);
        }}
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
              {deleteError && (
                <View paddingX="size-200" paddingTop="size-100">
                  <Alert variant="danger" banner>
                    {deleteError}
                  </Alert>
                </View>
              )}
              <View padding="size-200">
                <Text color="danger">
                  {`Are you sure you want to delete these experiments? This will also delete all associated annotations and traces, and it cannot be undone.`}
                </Text>
              </View>
              <View
                paddingEnd="size-200"
                paddingTop="size-100"
                paddingBottom="size-100"
                borderTopColor="default"
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
