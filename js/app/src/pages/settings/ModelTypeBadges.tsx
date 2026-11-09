import { Badge, Flex } from "@phoenix/components";

type ModelTypeValue = "LLM" | "DECISION" | "%future added value";

/**
 * Which model types a provider serves, as badges: chat (LLM) models and
 * decision models.
 */
export function ModelTypeBadges({
  modelTypes,
}: {
  modelTypes: ReadonlyArray<ModelTypeValue>;
}) {
  return (
    <Flex direction="row" gap="size-50" alignItems="center">
      {modelTypes.includes("LLM") ? <Badge size="S">chat</Badge> : null}
      {modelTypes.includes("DECISION") ? (
        <Badge size="S" variant="info">
          decisions
        </Badge>
      ) : null}
    </Flex>
  );
}
