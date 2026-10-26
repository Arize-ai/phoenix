import { useMemo } from "react";
import { graphql, useFragment } from "react-relay";

import {
  Card,
  CopyToClipboardButton,
  Disclosure,
  DisclosureGroup,
  DisclosurePanel,
  DisclosureTrigger,
  Text,
  View,
} from "@phoenix/components";
import { BashBlock } from "@phoenix/components/code";

import type { DecisionCodeExportCard_version$key } from "./__generated__/DecisionCodeExportCard_version.graphql";
import { buildRunDecisionVersionCurl } from "./decisionVersionUtils";

/**
 * How to run a decision version from code. Mirrors the prompt's code card.
 */
export function DecisionCodeExportCard({
  decisionVersion,
}: {
  decisionVersion: DecisionCodeExportCard_version$key;
}) {
  const data = useFragment<DecisionCodeExportCard_version$key>(
    graphql`
      fragment DecisionCodeExportCard_version on DecisionVersion {
        id
        inputs {
          name
        }
      }
    `,
    decisionVersion
  );
  const curl = useMemo(
    () =>
      buildRunDecisionVersionCurl({
        versionId: data.id,
        inputNames: data.inputs.map((input) => input.name),
      }),
    [data]
  );
  return (
    <Card
      title="Code"
      extra={
        <CopyToClipboardButton text={curl} aria-label="Copy decision request" />
      }
    >
      <DisclosureGroup defaultExpandedKeys={["curl"]}>
        <Disclosure id="curl">
          <DisclosureTrigger arrowPosition="start">
            <Text>cURL</Text>
          </DisclosureTrigger>
          <DisclosurePanel>
            <View paddingX="size-200" paddingTop="size-100">
              <Text color="text-700" size="XS">
                Set PHOENIX_ENDPOINT to your Phoenix URL and replace the input
                placeholders. The server uses the saved version’s connection and
                configured credentials.
              </Text>
            </View>
            <BashBlock value={curl} />
          </DisclosurePanel>
        </Disclosure>
      </DisclosureGroup>
    </Card>
  );
}
