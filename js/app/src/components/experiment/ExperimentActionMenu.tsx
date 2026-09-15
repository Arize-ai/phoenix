import copy from "copy-to-clipboard";
import { useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";
import { useNavigate, useParams } from "react-router";

import type { ButtonProps } from "@phoenix/components";
import {
  Alert,
  Button,
  Dialog,
  DialogFooter,
  Flex,
  Form,
  Icon,
  Icons,
  Input,
  Label,
  Menu,
  MenuItem,
  MenuTrigger,
  Modal,
  ModalOverlay,
  Popover,
  Text,
  TextField,
  View,
} from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";
import {
  DialogCloseButton,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTitleExtra,
} from "@phoenix/components/core/dialog";
import { useSetExperimentBaseline } from "@phoenix/components/experiment/useSetExperimentBaseline";
import { StopPropagation } from "@phoenix/components/StopPropagation";
import { useNotify, useNotifyError, useNotifySuccess } from "@phoenix/contexts";
import { useCredentialsContext } from "@phoenix/contexts/CredentialsContext";
import { toGqlCredentials } from "@phoenix/pages/playground/playgroundUtils";
import { assertUnreachable } from "@phoenix/typeUtils";
import { getErrorMessagesFromRelayMutationError } from "@phoenix/utils/errorUtils";

export enum ExperimentAction {
  GO_TO_EXPERIMENT_RUN_TRACES = "GO_TO_EXPERIMENT_RUN_TRACES",
  VIEW_EXPERIMENT_DETAILS = "VIEW_EXPERIMENT_DETAILS",
  COPY_EXPERIMENT_ID = "COPY_EXPERIMENT_ID",
  OPEN_IN_PLAYGROUND = "OPEN_IN_PLAYGROUND",
  TOGGLE_BASELINE = "TOGGLE_BASELINE",
  STOP_EXPERIMENT = "STOP_EXPERIMENT",
  RESUME_EXPERIMENT = "RESUME_EXPERIMENT",
  RENAME_EXPERIMENT = "RENAME_EXPERIMENT",
  DELETE_EXPERIMENT = "DELETE_EXPERIMENT",
}

type ExperimentJobStatus = "RUNNING" | "COMPLETED" | "STOPPED" | "ERROR";

type ExperimentActionMenuBaseProps = {
  projectId?: string | null;
  experimentId: string;
  metadata: unknown;
  jobStatus?: ExperimentJobStatus | null;
  size?: ButtonProps["size"];
} & (
  | {
      canSetBaseline: true;
      isBaseline: boolean;
    }
  | {
      canSetBaseline?: false;
      isBaseline?: undefined;
    }
);

type ExperimentActionMenuProps = ExperimentActionMenuBaseProps &
  (
    | {
        canDeleteExperiment: true;
        onExperimentDeleted: () => void;
      }
    | {
        canDeleteExperiment: false;
        onExperimentDeleted?: undefined;
      }
  ) &
  (
    | {
        canRenameExperiment: true;
        experimentName: string;
      }
    | {
        canRenameExperiment?: false;
        experimentName?: undefined;
      }
  );

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
  const [commitStopExperiment] = useMutation(graphql`
    mutation ExperimentActionMenuStopMutation($experimentId: ID!) {
      stopExperiment(experimentId: $experimentId) {
        job {
          id
          status
        }
      }
    }
  `);
  const [commitResumeExperiment] = useMutation(graphql`
    mutation ExperimentActionMenuResumeMutation(
      $experimentId: ID!
      $credentials: [GenerativeCredentialInput!]
    ) {
      resumeExperiment(experimentId: $experimentId, credentials: $credentials) {
        job {
          id
          status
        }
      }
    }
  `);
  const { projectId, jobStatus } = props;
  const { datasetId } = useParams();
  const credentials = useCredentialsContext((state) => state);
  const navigate = useNavigate();
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [isRenameDialogOpen, setIsRenameDialogOpen] = useState(false);
  const [isMetadataDialogOpen, setIsMetadataDialogOpen] = useState(false);
  const notify = useNotify();
  const notifyError = useNotifyError();
  const notifySuccess = useNotifySuccess();
  const { setExperimentBaseline, isSettingExperimentBaseline } =
    useSetExperimentBaseline();
  const [error, setError] = useState<string | null>(null);
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
          onExperimentDeleted?.();
          setIsDeleteDialogOpen(false);
        },
        onError: (error) => {
          const formattedError = getErrorMessagesFromRelayMutationError(error);
          setError(
            `Failed to delete experiment: ${formattedError?.[0] ?? error.message}`
          );
        },
      });
    },
    [commitDeleteExperiment, notifySuccess, onExperimentDeleted]
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
      key={ExperimentAction.VIEW_EXPERIMENT_DETAILS}
      id={ExperimentAction.VIEW_EXPERIMENT_DETAILS}
    >
      <Flex
        direction="row"
        gap="size-75"
        justifyContent="start"
        alignItems="center"
      >
        <Icon svg={<Icons.Info />} />
        <Text>View details</Text>
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
        <Icon svg={<Icons.Duplicate />} />
        <Text>Copy experiment ID</Text>
      </Flex>
    </MenuItem>,
  ];
  if (jobStatus != null) {
    menuItems.push(
      <MenuItem
        key={ExperimentAction.OPEN_IN_PLAYGROUND}
        id={ExperimentAction.OPEN_IN_PLAYGROUND}
      >
        <Flex
          direction="row"
          gap="size-75"
          justifyContent="start"
          alignItems="center"
        >
          <Icon svg={<Icons.PlayCircle />} />
          <Text>Open in Playground</Text>
        </Flex>
      </MenuItem>
    );
  }
  if (props.canSetBaseline) {
    menuItems.push(
      <MenuItem
        key={ExperimentAction.TOGGLE_BASELINE}
        id={ExperimentAction.TOGGLE_BASELINE}
      >
        <Flex
          direction="row"
          gap="size-75"
          justifyContent="start"
          alignItems="center"
        >
          <Icon
            svg={
              props.isBaseline ? <Icons.BookmarkX /> : <Icons.BookmarkCheck />
            }
          />
          <Text>
            {isSettingExperimentBaseline
              ? "Updating baseline..."
              : props.isBaseline
                ? "Remove baseline"
                : "Mark as baseline"}
          </Text>
        </Flex>
      </MenuItem>
    );
  }
  if (jobStatus === "RUNNING") {
    menuItems.push(
      <MenuItem
        key={ExperimentAction.STOP_EXPERIMENT}
        id={ExperimentAction.STOP_EXPERIMENT}
      >
        <Flex
          direction="row"
          gap="size-75"
          justifyContent="start"
          alignItems="center"
        >
          <Icon svg={<Icons.StopCircle />} />
          <Text>Stop</Text>
        </Flex>
      </MenuItem>
    );
  } else if (jobStatus != null) {
    menuItems.push(
      <MenuItem
        key={ExperimentAction.RESUME_EXPERIMENT}
        id={ExperimentAction.RESUME_EXPERIMENT}
      >
        <Flex
          direction="row"
          gap="size-75"
          justifyContent="start"
          alignItems="center"
        >
          <Icon svg={<Icons.PlayCircle />} />
          <Text>Resume</Text>
        </Flex>
      </MenuItem>
    );
  }
  if (props.canRenameExperiment) {
    menuItems.push(
      <MenuItem
        key={ExperimentAction.RENAME_EXPERIMENT}
        id={ExperimentAction.RENAME_EXPERIMENT}
      >
        <Flex
          direction="row"
          gap="size-75"
          justifyContent="start"
          alignItems="center"
        >
          <Icon svg={<Icons.Edit2 />} />
          <Text>Rename</Text>
        </Flex>
      </MenuItem>
    );
  }
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
          <Icon svg={<Icons.Trash />} />
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
          leadingVisual={<Icon svg={<Icons.MoreHorizontal />} />}
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
                case ExperimentAction.VIEW_EXPERIMENT_DETAILS: {
                  if (datasetId) {
                    navigate(
                      `/datasets/${datasetId}/experiments/${props.experimentId}`
                    );
                  }
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
                case ExperimentAction.OPEN_IN_PLAYGROUND: {
                  navigate(
                    `/playground?experimentId=${encodeURIComponent(props.experimentId)}`
                  );
                  break;
                }
                case ExperimentAction.TOGGLE_BASELINE: {
                  if (!props.canSetBaseline) {
                    break;
                  }
                  setExperimentBaseline({
                    experimentId: props.experimentId,
                    isBaseline: props.isBaseline,
                    onError: (message) => {
                      notifyError({
                        title: "Failed to update baseline",
                        message,
                      });
                    },
                  });
                  break;
                }
                case ExperimentAction.STOP_EXPERIMENT: {
                  commitStopExperiment({
                    variables: { experimentId: props.experimentId },
                    onCompleted: () => {
                      notify({
                        title: "Experiment stopped",
                        message: "The experiment has been stopped.",
                      });
                    },
                    onError: (error) => {
                      const msgs =
                        getErrorMessagesFromRelayMutationError(error);
                      setError(
                        `Failed to stop experiment: ${msgs?.[0] ?? error.message}`
                      );
                    },
                  });
                  break;
                }
                case ExperimentAction.RESUME_EXPERIMENT: {
                  commitResumeExperiment({
                    variables: {
                      experimentId: props.experimentId,
                      credentials: toGqlCredentials(credentials),
                    },
                    onCompleted: () => {
                      notifySuccess({
                        title: "Experiment resumed",
                        message: "The experiment has been resumed.",
                      });
                    },
                    onError: (error) => {
                      const msgs =
                        getErrorMessagesFromRelayMutationError(error);
                      setError(
                        `Failed to resume experiment: ${msgs?.[0] ?? error.message}`
                      );
                    },
                  });
                  break;
                }
                case ExperimentAction.RENAME_EXPERIMENT: {
                  setIsRenameDialogOpen(true);
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
        onOpenChange={(open) => {
          if (open) setError(null);
          setIsDeleteDialogOpen(open);
        }}
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
              {error && (
                <View paddingX="size-200" paddingTop="size-100">
                  <Alert
                    variant="danger"
                    dismissable
                    onDismissClick={() => setError(null)}
                  >
                    {error}
                  </Alert>
                </View>
              )}
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
      {props.canRenameExperiment ? (
        <RenameExperimentDialog
          experimentId={props.experimentId}
          experimentName={props.experimentName}
          isOpen={isRenameDialogOpen}
          onOpenChange={setIsRenameDialogOpen}
        />
      ) : null}
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

function RenameExperimentDialog({
  experimentId,
  experimentName,
  isOpen,
  onOpenChange,
}: {
  experimentId: string;
  experimentName: string;
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}) {
  const notifySuccess = useNotifySuccess();
  const [renameValue, setRenameValue] = useState(experimentName);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [commitRenameExperiment, isRenamingExperiment] = useMutation(graphql`
    mutation ExperimentActionMenuRenameExperimentMutation(
      $input: PatchExperimentInput!
    ) {
      patchExperiment(input: $input) {
        experiment {
          id
          name
        }
      }
    }
  `);
  const trimmedName = renameValue.trim();
  const isUnchanged = trimmedName === experimentName;
  const isRenameSaveDisabled =
    isRenamingExperiment || !trimmedName || isUnchanged;

  return (
    <ModalOverlay
      isDismissable
      isOpen={isOpen}
      onOpenChange={(open) => {
        if (open) {
          setRenameValue(experimentName);
          setRenameError(null);
        }
        onOpenChange(open);
      }}
    >
      <Modal size="S">
        <Dialog>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Rename experiment</DialogTitle>
              <DialogTitleExtra>
                <DialogCloseButton slot="close" />
              </DialogTitleExtra>
            </DialogHeader>
            {renameError ? (
              <View paddingX="size-200" paddingTop="size-100">
                <Alert variant="danger" banner>
                  {renameError}
                </Alert>
              </View>
            ) : null}
            <Form
              onSubmit={(event) => {
                event.preventDefault();
                if (isRenameSaveDisabled) {
                  return;
                }
                setRenameError(null);
                commitRenameExperiment({
                  variables: {
                    input: {
                      experimentId,
                      name: trimmedName,
                    },
                  },
                  onCompleted: () => {
                    notifySuccess({
                      title: "Experiment renamed",
                      message: `The experiment is now named "${trimmedName}".`,
                    });
                    onOpenChange(false);
                  },
                  onError: (error) => {
                    setRenameError(
                      getErrorMessagesFromRelayMutationError(error)?.[0] ??
                        error.message
                    );
                  },
                });
              }}
            >
              <View padding="size-200">
                <TextField
                  value={renameValue}
                  onChange={setRenameValue}
                  isDisabled={isRenamingExperiment}
                  isInvalid={!trimmedName}
                  autoFocus
                >
                  <Label>Name</Label>
                  <Input />
                  <Text slot="description">The name cannot be empty.</Text>
                </TextField>
              </View>
              <DialogFooter>
                <Button
                  size="S"
                  variant="default"
                  onPress={() => onOpenChange(false)}
                  isDisabled={isRenamingExperiment}
                >
                  Cancel
                </Button>
                <Button
                  size="S"
                  variant={isRenameSaveDisabled ? "default" : "primary"}
                  type="submit"
                  isDisabled={isRenameSaveDisabled}
                >
                  {isRenamingExperiment ? "Renaming..." : "Rename"}
                </Button>
              </DialogFooter>
            </Form>
          </DialogContent>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
