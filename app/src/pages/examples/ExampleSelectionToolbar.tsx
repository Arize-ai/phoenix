import { ReactNode, useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";

<<<<<<< HEAD
import {
  Button,
  Dialog,
  Flex,
  Icon,
  Icons,
  Modal,
  ModalOverlay,
  Text,
  View,
} from "@phoenix/components";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";
=======
import { DialogContainer } from "@arizeai/components";

import {
  Button,
  Flex,
  Icon,
  IconButton,
  Icons,
  Text,
  Toolbar,
  Tooltip,
  TooltipTrigger,
  View,
} from "@phoenix/components";
import { FloatingToolbarContainer } from "@phoenix/components/toolbar/FloatingToolbarContainer";
>>>>>>> 9ae502751b04da8ddd0da0964c349b98941eddca
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
      <Toolbar>
        <View paddingEnd="size-100">
          <Flex direction="row" gap="size-100" alignItems="center">
            <TooltipTrigger>
              <IconButton
                size="M"
                onPress={onClearSelection}
                aria-label="Clear selection"
              >
                <Icon svg={<Icons.CloseOutline />} />
              </IconButton>
              <Tooltip>Clear selection</Tooltip>
            </TooltipTrigger>
            <Text>{`${selectedExamples.length} example${isPlural ? "s" : ""} selected`}</Text>
          </Flex>
<<<<<<< HEAD
        </Flex>
      </View>
      <ModalOverlay
        isOpen={!!dialog}
        onOpenChange={(isOpen) => {
          if (!isOpen) {
            setDialog(null);
          }
=======
        </View>
        <Button
          variant="danger"
          size="M"
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
        >
          Delete
        </Button>
      </Toolbar>
      <DialogContainer
        onDismiss={() => {
          setDialog(null);
>>>>>>> 9ae502751b04da8ddd0da0964c349b98941eddca
        }}
        isDismissable
      >
<<<<<<< HEAD
        <Modal>
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Examples</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton />
                </DialogTitleExtra>
              </DialogHeader>
              <View padding="size-200">
                <Text color="danger">
                  Are you sure you want to delete these examples?
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
                  <Button size="S" onPress={() => setDialog(null)}>
                    Cancel
                  </Button>
                  <Button
                    variant="danger"
                    size="S"
                    onPress={() => {
                      onDeleteExamples();
                      setDialog(null);
                    }}
                  >
                    Delete
                  </Button>
                </Flex>
              </View>
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </div>
=======
        {dialog}
      </DialogContainer>
    </FloatingToolbarContainer>
>>>>>>> 9ae502751b04da8ddd0da0964c349b98941eddca
  );
}
