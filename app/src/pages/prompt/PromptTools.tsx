import React, { useMemo, useState } from "react";
import { graphql, useFragment } from "react-relay";

import { Dialog, DialogContainer, List, ListItem } from "@arizeai/components";

import { CopyToClipboardButton, Flex, Text, View } from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";
import { PromptTools__main$key } from "@phoenix/pages/prompt/__generated__/PromptTools__main.graphql";
import {
  findToolDefinitionDescription,
  findToolDefinitionName,
} from "@phoenix/schemas/toolSchemas";
import { safelyStringifyJSON } from "@phoenix/utils/jsonUtils";

type ToolDefinitionItem = {
  name: string;
  description?: string;
  definition: string;
};

function ToolDefinitionItem({ name, description }: ToolDefinitionItem) {
  return (
    <View paddingStart="size-100" paddingEnd="size-100">
      <Flex direction="row" justifyContent="space-between">
        <Text weight="heavy">{name}</Text>
        <Text>{description}</Text>
      </Flex>
    </View>
  );
}

export function PromptTools({
  promptVersion,
}: {
  promptVersion: PromptTools__main$key;
}) {
  const [dialog, setDialog] = useState<ToolDefinitionItem | null>(null);
  const { tools } = useFragment<PromptTools__main$key>(
    graphql`
      fragment PromptTools__main on PromptVersion {
        tools {
          definition
        }
      }
    `,
    promptVersion
  );

  const items: ToolDefinitionItem[] = useMemo(() => {
    return tools.map((tool, i) => {
      const definition = tool.definition;
      return {
        name: findToolDefinitionName(definition) || `Tool ${i + 1}`,
        description: findToolDefinitionDescription(definition) || undefined,
        definition: safelyStringifyJSON(definition, null, 2).json || "{}",
      };
    });
  }, [tools]);

  if (items.length === 0) {
    return (
      <View padding="size-200">
        <Flex justifyContent="center" alignItems="center">
          <Text>No tools specified for this prompt</Text>
        </Flex>
      </View>
    );
  }

  return (
    <>
      <List listSize="small">
        {items.map((item, i) => (
          <ListItem
            key={`${item.name}-${i}`}
            interactive
            onClick={() => setDialog(item)}
          >
            <ToolDefinitionItem {...item} />
          </ListItem>
        ))}
      </List>
      <DialogContainer isDismissable onDismiss={() => setDialog(null)}>
        {dialog ? (
          <Dialog
            title={dialog.name}
            extra={<CopyToClipboardButton text={dialog.definition} />}
            size="M"
          >
            <View
              padding="size-100"
              minHeight={350}
              maxHeight={500}
              overflow={"auto"}
            >
              <JSONBlock value={dialog.definition} />
            </View>
          </Dialog>
        ) : null}
      </DialogContainer>
    </>
  );
}
