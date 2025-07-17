import { useMemo } from "react";
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
import { PromptResponseFormatFragment$key } from "@phoenix/pages/prompt/__generated__/PromptResponseFormatFragment.graphql";
import { safelyParseJSON, safelyStringifyJSON } from "@phoenix/utils/jsonUtils";

export function PromptResponseFormat({
  promptVersion,
}: {
  promptVersion: PromptResponseFormatFragment$key;
}) {
  const { responseFormat } = useFragment<PromptResponseFormatFragment$key>(
    graphql`
      fragment PromptResponseFormatFragment on PromptVersion {
        responseFormat {
          definition
        }
      }
    `,
    promptVersion
  );

  const formattedResponseFormat = useMemo(() => {
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

  if (!formattedResponseFormat) {
    return (
      <Disclosure id="response-format">
        <DisclosureTrigger>Response Format</DisclosureTrigger>
        <DisclosurePanel>
          <View padding="size-200">
            <Flex justifyContent="center" alignItems="center">
              <Text color="text-300">
                No response format specified for this prompt
              </Text>
            </Flex>
          </View>
        </DisclosurePanel>
      </Disclosure>
    );
  }

  return (
    <Disclosure id="response-format">
      <DisclosureTrigger>Response Format</DisclosureTrigger>
      <DisclosurePanel>
        <JSONBlock value={formattedResponseFormat} />
      </DisclosurePanel>
    </Disclosure>
  );
}
