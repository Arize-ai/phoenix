import {
  Card,
  CopyToClipboardButton,
  Flex,
  Text,
  View,
} from "@phoenix/components";

import { PxiRing, PxiTag } from "../SolveWithPxi";
import type { PxiScenario, PxiScenarioProps } from "./types";

const scenario: PxiScenario = {
  title: "Ring — panel section",
  Component: function RingPanel({ ringState }: PxiScenarioProps) {
    return (
      <PxiRing state={ringState}>
        <Card
          title="Output"
          extra={
            <CopyToClipboardButton
              size="S"
              text="output"
              tooltipText="Copy output"
            />
          }
        >
          <View padding="size-200">
            <Flex direction="column" gap="size-100">
              <Text size="S">
                The retrieval step returned three documents, but the final
                answer cites a source that is not among them — a likely
                hallucination introduced during synthesis.
              </Text>
              <Flex direction="row" gap="size-75" alignItems="center">
                <Text size="XS" color="text-500">
                  Root cause analysis by
                </Text>
                <PxiTag />
              </Flex>
            </Flex>
          </View>
        </Card>
      </PxiRing>
    );
  },
};

export default scenario;
