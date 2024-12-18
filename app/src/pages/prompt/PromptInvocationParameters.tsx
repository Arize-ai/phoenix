import React, { useMemo } from "react";
import { graphql, useFragment } from "react-relay";
import { isObject } from "lodash";
import { css } from "@emotion/react";

import { Flex, Text, View } from "@arizeai/components";

import { PromptInvocationParameters__main$key } from "./__generated__/PromptInvocationParameters__main.graphql";

function PromptInvocationParameterItem({
  keyName,
  value,
}: {
  keyName: string;
  value: unknown;
}) {
  return (
    <View padding="size-100">
      <Flex direction="row" justifyContent="space-between">
        <Text weight="heavy">{keyName}</Text>
        <Text>{String(value)}</Text>
      </Flex>
    </View>
  );
}

const promptInvocationParametersCSS = css`
  // every other row should have a background color
  & > *:nth-child(even) {
    background-color: var(--ac-global-background-color-light);
    border-radius: 4px;
  }
`;

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
          <Text>No parameters recorded for this prompt</Text>
        </Flex>
      </View>
    );
  }

  return (
    <View width="100%">
      <div css={promptInvocationParametersCSS}>
        {parameters.map(({ key, value }) => (
          <PromptInvocationParameterItem
            keyName={key}
            value={value}
            key={key}
          />
        ))}
      </div>
    </View>
  );
}
