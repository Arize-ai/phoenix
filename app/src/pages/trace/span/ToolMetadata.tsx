import { css } from "@emotion/react";

import { Card, Flex, Text, View } from "@phoenix/components";

import { ReadonlyJSONBlock } from "../ReadonlyJSONBlock";
import { defaultCardProps } from "./constants";

/**
 * A card describing the tool of a tool span — its name, description, and
 * parameter schema.
 */
export function ToolMetadata({
  name,
  description,
  parameters,
}: {
  name?: string;
  description?: string;
  parameters?: string;
}) {
  return (
    <Card
      title={"Tool" + (typeof name === "string" ? `: ${name}` : "")}
      {...defaultCardProps}
    >
      <Flex direction="column">
        {description != null ? (
          <View
            paddingStart="size-200"
            paddingEnd="size-200"
            paddingTop="size-100"
            paddingBottom="size-100"
            borderBottomColor="default"
            borderBottomWidth="thin"
          >
            <Flex direction="column" alignItems="start" gap="size-50">
              <Text color="text-700" fontStyle="italic">
                Description
              </Text>
              <Text>{description}</Text>
            </Flex>
          </View>
        ) : null}
        {parameters != null ? (
          <View
            paddingStart="size-200"
            paddingEnd="size-200"
            paddingTop="size-100"
            paddingBottom="size-100"
            borderBottomColor="default"
            borderBottomWidth="thin"
          >
            <Flex direction="column" alignItems="start" width="100%">
              <Text color="text-700" fontStyle="italic">
                Parameters
              </Text>
              <div
                css={css`
                  .cm-editor {
                    background-color: transparent !important;
                  }
                `}
              >
                <ReadonlyJSONBlock
                  basicSetup={{ lineNumbers: false, foldGutter: false }}
                >
                  {JSON.stringify(parameters)}
                </ReadonlyJSONBlock>
              </div>
            </Flex>
          </View>
        ) : null}
      </Flex>
    </Card>
  );
}
