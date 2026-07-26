import { Flex, Icon, Icons, Text, Token } from "@phoenix/components";
import type { AnnotationConfig } from "@phoenix/components/annotation/types";

export function AnnotationConfigStatus({
  annotationType,
}: {
  annotationType?: AnnotationConfig["annotationType"] | null;
}) {
  if (annotationType) {
    return <Token size="S">{annotationType.toLocaleLowerCase()}</Token>;
  }

  return (
    <Flex direction="row" gap="size-50" alignItems="center">
      <Icon svg={<Icons.AlertTriangle />} color="warning" aria-hidden="true" />
      <Text size="XS" color="text-500">
        Missing config
      </Text>
    </Flex>
  );
}
