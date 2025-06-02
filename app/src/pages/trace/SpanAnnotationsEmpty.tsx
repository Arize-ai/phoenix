import { EmptyGraphic } from "@arizeai/components";

import {
  ExternalLinkButton,
  Flex,
  Icon,
  Icons,
  Text,
  View,
} from "@phoenix/components";

export function SpanAnnotationsEmpty() {
  return (
    <View padding="size-200">
      <Flex direction="column" gap="size-100" alignItems="center">
        <EmptyGraphic graphicKey="documents" />
        <Text>No annotations for this span</Text>

        <ExternalLinkButton
          leadingVisual={<Icon svg={<Icons.Edit2Outline />} />}
          href="https://arize.com/docs/phoenix/tracing/concepts-tracing/how-to-evaluate-traces"
          size="S"
        >
          How to Annotate
        </ExternalLinkButton>
      </Flex>
    </View>
  );
}
