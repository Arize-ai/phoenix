import { Badge, Flex } from "@phoenix/components";

type ModelTypeValue = "CHAT" | "DECISION" | "%future added value";

export function ModelTypeBadges({
  modelTypes,
}: {
  modelTypes: ReadonlyArray<ModelTypeValue>;
}) {
  return (
    <Flex direction="row" gap="size-50" alignItems="center">
      {modelTypes.includes("CHAT") ? <Badge size="S">chat</Badge> : null}
      {modelTypes.includes("DECISION") ? (
        <Badge size="S" variant="info">
          decisions
        </Badge>
      ) : null}
    </Flex>
  );
}
