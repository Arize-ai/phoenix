import isObject from "lodash/isObject";
import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";

import { Flex, List, ListItem, Text, View } from "@phoenix/components";
import { safelyStringifyJSON } from "@phoenix/utils/jsonUtils";

import type { PromptInvocationParameters__main$key } from "./__generated__/PromptInvocationParameters__main.graphql";

function formatToolChoiceLabel(
  type: string,
  functionName: string | null | undefined
): string {
  switch (type) {
    case "NONE":
      return "none";
    case "ZERO_OR_MORE":
      return "auto";
    case "ONE_OR_MORE":
      return "required";
    case "SPECIFIC_FUNCTION":
      return functionName ? `function: ${functionName}` : "specific function";
    default:
      return type;
  }
}

function PromptInvocationParameterItem({
  keyName,
  value,
}: {
  keyName: string;
  value: unknown;
}) {
  const { json, stringifyError } = safelyStringifyJSON(value);
  if (stringifyError) {
    return null;
  }
  return (
    <View paddingStart="size-100" paddingEnd="size-100">
      <Flex direction="row" justifyContent="space-between">
        <Text size="XS" color="text-700">
          {keyName}
        </Text>
        <Text size="XS">{json}</Text>
      </Flex>
    </View>
  );
}

type PromptInvocationParametersProps = {
  promptVersion: PromptInvocationParameters__main$key;
};

export function PromptInvocationParameters({
  promptVersion,
}: PromptInvocationParametersProps) {
  const { invocationParameters, tools } =
    useFragment<PromptInvocationParameters__main$key>(
      graphql`
        fragment PromptInvocationParameters__main on PromptVersion {
          invocationParameters
          tools {
            toolChoice {
              type
              functionName
            }
          }
        }
      `,
      promptVersion
    );
  const parameters = useMemo(() => {
    if (!isObject(invocationParameters)) {
      return [];
    }
    return Object.entries(invocationParameters).map(([key, value]) => ({
      key,
      value,
    }));
  }, [invocationParameters]);

  const toolChoice = tools?.toolChoice;
  const hasToolChoice = toolChoice != null;
  const hasParameters = parameters.length > 0;

  if (!hasToolChoice && !hasParameters) {
    return (
      <View padding="size-200">
        <Flex justifyContent="center" alignItems="center">
          <Text color="text-300">No parameters saved for this prompt</Text>
        </Flex>
      </View>
    );
  }

  return (
    <List size="S">
      {hasToolChoice && (
        <ListItem>
          <View paddingStart="size-100" paddingEnd="size-100">
            <Flex direction="row" justifyContent="space-between">
              <Text size="XS" color="text-700">
                tool_choice
              </Text>
              <Text size="XS">
                {formatToolChoiceLabel(
                  toolChoice.type,
                  toolChoice.functionName ?? undefined
                )}
              </Text>
            </Flex>
          </View>
        </ListItem>
      )}
      {parameters.map(({ key, value }, i) => (
        <ListItem key={`${key}-${i}`}>
          <PromptInvocationParameterItem keyName={key} value={value} />
        </ListItem>
      ))}
    </List>
  );
}
