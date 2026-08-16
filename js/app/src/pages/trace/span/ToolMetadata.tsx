import { css } from "@emotion/react";

import {
  Card,
  CopyToClipboardButton,
  Flex,
  Text,
  View,
} from "@phoenix/components";

import { ReadonlyJSONBlock } from "../ReadonlyJSONBlock";
import { defaultCardProps } from "./constants";
import { formatJSONForCopy, parseJSONDocument } from "./utils";

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
      // the tool as one document, so it can be pasted back into a tool
      // definition rather than reassembled from the fields on screen
      extra={
        <CopyToClipboardButton
          text={formatJSONForCopy({
            name,
            description,
            parameters:
              parameters == null ? undefined : parseJSONDocument(parameters),
          })}
        />
      }
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
                {/* the parameter schema arrives as JSON text already, so it
                    goes to the block as it came: encoding it again would show
                    the reader one escaped line instead of the schema, and
                    would not match what the card's copy button hands back */}
                <ReadonlyJSONBlock
                  basicSetup={{ lineNumbers: false, foldGutter: false }}
                >
                  {parameters}
                </ReadonlyJSONBlock>
              </div>
            </Flex>
          </View>
        ) : null}
      </Flex>
    </Card>
  );
}
