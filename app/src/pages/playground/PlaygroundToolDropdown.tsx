import React, { Key, ReactNode, useCallback, useState } from "react";
import { css } from "@emotion/react";

import {
  ActionMenu,
  Button,
  Counter,
  DialogContainer,
  Flex,
  Icon,
  Icons,
  Item,
} from "@arizeai/components";

import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { createTool } from "@phoenix/store";

import { PlaygroundToolDialog } from "./PlaygroundToolDialog";
import { PlaygroundInstanceProps } from "./types";

const parseToolId = (id: Key) => {
  if (typeof id === "number") {
    return id;
  }
  if (typeof id === "string") {
    return parseInt(id);
  }
};

interface PlaygroundToolsProps extends PlaygroundInstanceProps {}

export function PlaygroundToolDropDown(props: PlaygroundToolsProps) {
  const instanceId = props.playgroundInstanceId;
  const instance = usePlaygroundContext((state) =>
    state.instances.find(
      (instance) => instance.id === props.playgroundInstanceId
    )
  );
  if (instance == null) {
    throw new Error(`Playground instance ${instanceId} not found`);
  }
  const { tools } = instance;
  const hasTools = tools.length > 0;

  const [toolDialog, setToolDialog] = useState<ReactNode>(null);

  const addNewTool = useCallback(() => {
    const newTool = createTool(tools.length + 1);
    setToolDialog(
      <PlaygroundToolDialog
        instanceTools={instance.tools}
        playgroundInstanceId={instanceId}
        tool={newTool}
        onClose={() => setToolDialog(null)}
      />
    );
  }, [instance.tools, instanceId, tools.length]);

  const editTool = useCallback(
    (toolId: number) => {
      const tool = tools.find((t) => t.id === toolId);
      if (tool == null) {
        return;
      }
      setToolDialog(
        <PlaygroundToolDialog
          instanceTools={instance.tools}
          playgroundInstanceId={instanceId}
          tool={tool}
          onClose={() => setToolDialog(null)}
        />
      );
    },
    [instance.tools, instanceId, tools]
  );

  return (
    <>
      {!hasTools ? (
        <Button
          variant="default"
          size="compact"
          icon={<Icon svg={<Icons.PlusOutline />} />}
          onClick={addNewTool}
        >
          Tools
        </Button>
      ) : (
        <ActionMenu
          buttonText={"Tools"}
          icon={
            <span
              css={css`
                margin-right: var(--ac-global-dimension-size-50);
              `}
            >
              <Counter variant="light">{tools.length}</Counter>
            </span>
          }
          buttonSize="compact"
          onAction={(action) => {
            if (action === "add") {
              addNewTool();
            }
            const parsedId = parseToolId(action);
            if (parsedId != null) {
              editTool(parsedId);
            }
          }}
        >
          {[
            ...tools.map((tool) => {
              return (
                <Item key={tool.id}>
                  <Flex gap={"size-50"}>{tool.definition.function.name}</Flex>
                </Item>
              );
            }),
            <Item key="add">
              <Flex gap={"size-50"}>
                <Icon svg={<Icons.PlusOutline />} />
                Add Tool
              </Flex>
            </Item>,
          ]}
        </ActionMenu>
      )}
      <DialogContainer
        type="modal"
        isDismissable
        onDismiss={() => {
          setToolDialog(null);
        }}
      >
        {toolDialog}
      </DialogContainer>
    </>
  );
}
