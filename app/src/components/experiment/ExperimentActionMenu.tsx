import { useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";
import { useNavigate } from "react-router";
import copy from "copy-to-clipboard";

import {
  Button,
  ButtonProps,
  Dialog,
  Flex,
  Icon,
  Icons,
  Menu,
  MenuItem,
  MenuTrigger,
  Modal,
  ModalOverlay,
  Popover,
  Text,
  View,
} from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/dialog";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import { useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { assertUnreachable } from "@phoenix/typeUtils";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

export enum ExperimentAction {
  GO_TO_EXPERIMENT_RUN_TRACES = "GO_TO_EXPERIMENT_RUN_TRACES",
  COPY_EXPERIMENT_ID = "COPY_EXPERIMENT_ID",
  VIEW_METADATA = "VIEW_METADATA",
  DELETE_EXPERIMENT = "DELETE_EXPERIMENT",
}

type ExperimentActionMenuProps =
  | {
      projectId?: string | null;
      experimentId: string;
      metadata: unknown;
      canDeleteExperiment: true;
      size?: ButtonProps["size"];
      onExperimentDeleted: () => void;
    }
  | {
      projectId?: string | null;
      experimentId: string;
      metadata: unknown;
      canDeleteExperiment: false;
      size?: ButtonProps["size"];
      onExperimentDeleted?: undefined;
    };

export function ExperimentActionMenu(props: ExperimentActionMenuProps) {
  const [commitDeleteExperiment, isDeletingExperiment] = useMutation(graphql`
    mutation ExperimentActionMenuDeleteExperimentMutation(
      $input: DeleteExperimentsInput!
    ) {
      deleteExperiments(input: $input) {
        __typename
      }
    }
  `);
  const { projectId } = props;
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isMetadataDialogOpen, setIsMetadataDialogOpen] = useState(false);
  const notifySuccess = useNotifySuccess();
  const notifyError = useNotifyError();
  const onExperimentDeleted = props.onExperimentDeleted;

  const onDeleteExperiment = useCallback(
    (experimentId: string) => {
      commitDeleteExperiment({
        variables: {
          input: {
            experimentIds: [experimentId],
          },
        },
        onCompleted: () => {
          notifySuccess({
            title: "Experiment deleted",
            message: `The experiment has been deleted.`,
          });
        },
        onError: (error) => {
          const formattedError = getErrorMessagesFromRelayMutationError(error);
          notifyError({
            title: "An error occurred",
            message: `Failed to delete experiment: ${formattedError?.[0] ?? error.message}`,
          });
        },
      });
      onExperimentDeleted?.();
      setIsDeleteDialogOpen(false);
    },
    [commitDeleteExperiment, notifySuccess, notifyError, onExperimentDeleted]
  );

  const menuItems = [
    <MenuItem
      key={ExperimentAction.GO_TO_EXPERIMENT_RUN_TRACES}
      id={ExperimentAction.GO_TO_EXPERIMENT_RUN_TRACES}
    >
      <Flex
        direction="row"
        gap="size-75"
        justifyContent="start"
        alignItems="center"
      >
        <Icon svg={<Icons.Trace />} />
        <Text>View run traces</Text>
      </Flex>
    </MenuItem>,
    <MenuItem
      key={ExperimentAction.VIEW_METADATA}
      id={ExperimentAction.VIEW_METADATA}
    >
      <Flex
        direction="row"
        gap="size-75"
        justifyContent="start"
        alignItems="center"
      >
        <Icon svg={<Icons.InfoOutline />} />
        <Text>View metadata</Text>
      </Flex>
    </MenuItem>,
    <MenuItem
      key={ExperimentAction.COPY_EXPERIMENT_ID}
      id={ExperimentAction.COPY_EXPERIMENT_ID}
    >
      <Flex
        direction="row"
        gap="size-75"
        justifyContent="start"
        alignItems="center"
      >
        <Icon svg={<Icons.ClipboardCopy />} />
        <Text>Copy experiment ID</Text>
      </Flex>
    </MenuItem>,
  ];
  if (props.canDeleteExperiment) {
    menuItems.push(
      <MenuItem
        key={ExperimentAction.DELETE_EXPERIMENT}
        id={ExperimentAction.DELETE_EXPERIMENT}
      >
        <Flex
          direction="row"
          gap="size-75"
          justifyContent="start"
          alignItems="center"
        >
          <Icon svg={<Icons.TrashOutline />} />
          <Text>{isDeletingExperiment ? "Deleting..." : "Delete"}</Text>
        </Flex>
      </MenuItem>
    );
  }

  return (
    <StopPropagation>
      <MenuTrigger>
        <Button
          size={props.size}
          aria-label="Experiment action menu"
          leadingVisual={<Icon svg={<Icons.MoreHorizontalOutline />} />}
        />
        <Popover>
          <Menu
            disabledKeys={
              projectId ? [] : [ExperimentAction.GO_TO_EXPERIMENT_RUN_TRACES]
            }
            onAction={(firedAction) => {
              const action = firedAction as ExperimentAction;
              switch (action) {
                case ExperimentAction.GO_TO_EXPERIMENT_RUN_TRACES: {
                  return navigate(`/projects/${projectId}`);
                }
                case ExperimentAction.VIEW_METADATA: {
                  setIsMetadataDialogOpen(true);
                  break;
                }
                case ExperimentAction.COPY_EXPERIMENT_ID: {
                  copy(props.experimentId);
                  notifySuccess({
                    title: "Copied",
                    message:
                      "The experiment ID has been copied to your clipboard",
                  });
                  break;
                }
                case ExperimentAction.DELETE_EXPERIMENT: {
                  setIsDeleteDialogOpen(true);
                  break;
                }
                default: {
                  assertUnreachable(action);
                }
              }
            }}
          >
            {menuItems}
          </Menu>
        </Popover>
      </MenuTrigger>
      <ModalOverlay
        isDismissable
        isOpen={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
      >
        <Modal size="S">
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Experiment</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton slot="close" />
                </DialogTitleExtra>
              </DialogHeader>
              <View padding="size-200">
                <Text color="danger">
                  Are you sure you want to delete this experiment and its
                  annotations and traces?
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
                    onPress={() => onDeleteExperiment(props.experimentId)}
                  >
                    Delete Experiment
                  </Button>
                </Flex>
              </View>
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
      {/* Metadata Dialog */}
      <ModalOverlay
        isDismissable
        isOpen={isMetadataDialogOpen}
        onOpenChange={setIsMetadataDialogOpen}
      >
        <Modal size="S">
          <Dialog>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Metadata</DialogTitle>
                <DialogTitleExtra>
                  <DialogCloseButton slot="close" />
                </DialogTitleExtra>
              </DialogHeader>
              <JSONBlock value={JSON.stringify(props.metadata, null, 2)} />
            </DialogContent>
          </Dialog>
        </Modal>
      </ModalOverlay>
    </StopPropagation>
  );
}
