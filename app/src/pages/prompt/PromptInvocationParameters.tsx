import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";
import isObject from "lodash/isObject";

import { List, ListItem } from "@arizeai/components";

import { Flex, Text, View } from "@phoenix/components";
import { safelyStringifyJSON } from "@phoenix/utils/jsonUtils";

import { PromptInvocationParameters__main$key } from "./__generated__/PromptInvocationParameters__main.graphql";

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
  const { invocationParameters } =
    useFragment<PromptInvocationParameters__main$key>(
      graphql`
        fragment PromptInvocationParameters__main on PromptVersion {
          invocationParameters
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

  if (parameters.length === 0) {
    return (
      <View padding="size-200">
        <Flex justifyContent="center" alignItems="center">
          <Text color="text-300">No parameters saved for this prompt</Text>
        </Flex>
      </View>
    );
  }

  return (
    <List listSize="small">
      {parameters.map(({ key, value }, i) => (
        <ListItem key={`${key}-${i}`}>
          <PromptInvocationParameterItem keyName={key} value={value} />
        </ListItem>
      ))}
    </List>
  );
}
