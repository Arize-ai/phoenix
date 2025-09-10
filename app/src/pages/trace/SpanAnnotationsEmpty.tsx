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
    <View padding="size-400">
      <Flex direction="column" gap="size-100" alignItems="center">
        <Text size="L">No annotations for this span</Text>

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
