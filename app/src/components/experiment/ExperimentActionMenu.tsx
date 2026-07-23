import copy from "copy-to-clipboard";
import { useCallback, useState } from "react";
import { graphql, useMutation } from "react-relay";
import { useNavigate, useParams } from "react-router";

import type { ButtonProps } from "@phoenix/components";
import {
  Alert,
  Button,
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
      onBaselineChanged?: () => void;
    }
  | {
      canSetBaseline?: false;
      isBaseline?: undefined;
      onBaselineChanged?: never;
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
                    onCompleted: props.onBaselineChanged,
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
