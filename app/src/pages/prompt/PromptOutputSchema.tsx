import React, { useMemo } from "react";
import { graphql, useFragment } from "react-relay";

import {
  Disclosure,
  DisclosurePanel,
  DisclosureTrigger,
  Flex,
  Text,
  View,
} from "@phoenix/components";
import { JSONBlock } from "@phoenix/components/code";
import { PromptOutputSchemaFragment$key } from "@phoenix/pages/prompt/__generated__/PromptOutputSchemaFragment.graphql";
import { safelyParseJSON, safelyStringifyJSON } from "@phoenix/utils/jsonUtils";

export function PromptOutputSchema({
  promptVersion,
}: {
  promptVersion: PromptOutputSchemaFragment$key;
}) {
  const { responseFormat } = useFragment<PromptOutputSchemaFragment$key>(
    graphql`
      fragment PromptOutputSchemaFragment on PromptVersion {
        responseFormat {
          definition
        }
      }
    `,
    promptVersion
  );

  const formattedOutputSchema = useMemo(() => {
    if (typeof responseFormat?.definition === "string") {
      return (
        safelyStringifyJSON(
          safelyParseJSON(responseFormat?.definition).json || "",
          null,
          2
        ).json || ""
      );
    }
    return safelyStringifyJSON(responseFormat?.definition, null, 2).json || "";
  }, [responseFormat?.definition]);

  if (!formattedOutputSchema) {
    return (
      <Disclosure id="output-schema">
        <DisclosureTrigger>Output Schema</DisclosureTrigger>
        <DisclosurePanel>
          <View padding="size-200">
            <Flex justifyContent="center" alignItems="center">
              <Text color="text-300">
                No output schema specified for this prompt
              </Text>
            </Flex>
          </View>
        </DisclosurePanel>
      </Disclosure>
    );
  }

  return (
    <Disclosure id="output-schema">
      <DisclosureTrigger>Output Schema</DisclosureTrigger>
      <DisclosurePanel>
        <JSONBlock value={formattedOutputSchema} />
      </DisclosurePanel>
    </Disclosure>
  );
}
