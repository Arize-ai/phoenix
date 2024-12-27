import React, { ReactNode, useState } from "react";
import { useNavigate } from "react-router";
import copy from "copy-to-clipboard";

import {
  ActionMenu,
  ActionMenuProps,
  Dialog,
  DialogContainer,
  Item,
  Text,
} from "@arizeai/components";

import { Flex, Icon, Icons } from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";
import { useNotifySuccess } from "@phoenix/contexts";
import { assertUnreachable } from "@phoenix/typeUtils";

export enum ExperimentAction {
  GO_TO_EXPERIMENT_RUN_TRACES = "GO_TO_EXPERIMENT_RUN_TRACES",
  COPY_EXPERIMENT_ID = "COPY_EXPERIMENT_ID",
  VIEW_METADATA = "VIEW_METADATA",
}

export function ExperimentActionMenu(props: {
  projectId?: string | null;
  experimentId: string;
  metadata: unknown;
  isQuiet?: ActionMenuProps<string>["isQuiet"];
}) {
  const { projectId, isQuiet = false } = props;
  const navigate = useNavigate();
  const [dialog, setDialog] = useState<ReactNode>(null);
  const notifySuccess = useNotifySuccess();
  return (
    <div
      // TODO: add this logic to the ActionMenu component
      onClick={(e) => {
        // prevent parent anchor link from being followed
        e.preventDefault();
        e.stopPropagation();
      }}
    >
      <ActionMenu
        buttonSize="compact"
        align="end"
        isQuiet={isQuiet}
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
              setDialog(
                <Dialog title="Metadata" onDismiss={() => setDialog(null)}>
                  <JSONBlock value={JSON.stringify(props.metadata, null, 2)} />
                </Dialog>
              );
              break;
            }
            case ExperimentAction.COPY_EXPERIMENT_ID: {
              copy(props.experimentId);
              notifySuccess({
                title: "Copied",
                message: "The experiment ID has been copied to your clipboard",
              });
              break;
            }
            default: {
              assertUnreachable(action);
            }
          }
        }}
      >
        <Item key={ExperimentAction.GO_TO_EXPERIMENT_RUN_TRACES}>
          <Flex
            direction="row"
            gap="size-75"
            justifyContent="start"
            alignItems="center"
          >
            <Icon svg={<Icons.Trace />} />
            <Text>View run traces</Text>
          </Flex>
        </Item>
        <Item key={ExperimentAction.VIEW_METADATA}>
          <Flex
            direction="row"
            gap="size-75"
            justifyContent="start"
            alignItems="center"
          >
            <Icon svg={<Icons.InfoOutline />} />
            <Text>View metadata</Text>
          </Flex>
        </Item>
        <Item key={ExperimentAction.COPY_EXPERIMENT_ID}>
          <Flex
            direction="row"
            gap="size-75"
            justifyContent="start"
            alignItems="center"
          >
            <Icon svg={<Icons.ClipboardCopy />} />
            <Text>Copy experiment ID</Text>
          </Flex>
        </Item>
      </ActionMenu>
      <DialogContainer
        type="modal"
        isDismissable
        onDismiss={() => {
          setDialog(null);
        }}
      >
        {dialog}
      </DialogContainer>
    </div>
  );
}
