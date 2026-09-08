import { css } from "@emotion/react";

import { Card, Flex, Text, View } from "@phoenix/components";

const mapGridCSS = css`
  display: grid;
  grid-template-columns: 1fr;
  gap: var(--global-dimension-size-150);

  @media (max-width: 1100px) {
    grid-template-columns: 1fr 1fr;
  }

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

function MappingTile({
  title,
  description,
  entries,
  emptyLabel,
  formatValue,
}: {
  title: string;
  description: string;
  entries: ReadonlyArray<[string, unknown]>;
  emptyLabel: string;
  formatValue: (value: unknown) => string;
}) {
  return (
    <Flex direction="column" gap="size-100" elementType="section">
      <Flex direction="column" gap="size-25">
        <Text weight="heavy" size="S" elementType="h4">
          {title}
        </Text>
        <Text size="XS" color="text-700">
          {description}
        </Text>
      </Flex>
      {entries.length === 0 ? (
        <Text size="XS" color="text-500">
          {emptyLabel}
        </Text>
      ) : (
        <Flex direction="column" gap="size-75">
          {entries.map(([key, value]) => (
            <Flex
              key={key}
              direction="row"
              gap="size-100"
              alignItems="baseline"
            >
              <Text size="S" fontFamily="mono" color="text-700">
                {key}
              </Text>
              <Text size="S" color="text-500" aria-hidden="true">
                →
              </Text>
              <Text size="S" fontFamily="mono">
                {formatValue(value)}
              </Text>
            </Flex>
          ))}
        </Flex>
      )}
    </Flex>
  );
}

function formatPathMappingValue(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

function formatLiteral(value: unknown): string {
  if (value == null) return "null";
  if (typeof value === "string") return JSON.stringify(value);
  if (typeof value === "boolean" || typeof value === "number") {
    return String(value);
  }
  return JSON.stringify(value);
}

/**
 * Read-only card of a code evaluator's input mapping: which function args map
 * to which paths on the evaluated payload, plus any fixed literal values.
 * Shared by the dataset and project evaluator details pages.
 */
export function EvaluatorInputMappingCard({
  inputMapping,
  pathMappingDescription,
}: {
  inputMapping: {
    readonly pathMapping: unknown;
    readonly literalMapping: unknown;
  };
  /** Names what the paths point into, e.g. "fields on the example". */
  pathMappingDescription: string;
}) {
  const pathMappingEntries = Object.entries(
    (inputMapping.pathMapping as Record<string, unknown>) ?? {}
  );
  const literalMappingEntries = Object.entries(
    (inputMapping.literalMapping as Record<string, unknown>) ?? {}
  );

  return (
    <Card title="Input Mapping">
      <View padding="size-200">
        <div css={mapGridCSS}>
          <MappingTile
            title="Path mapping"
            description={pathMappingDescription}
            entries={pathMappingEntries}
            emptyLabel="No paths set"
            formatValue={formatPathMappingValue}
          />
          <MappingTile
            title="Literal mapping"
            description="Pass fixed literal values to function args"
            entries={literalMappingEntries}
            emptyLabel="No literals set"
            formatValue={formatLiteral}
          />
        </div>
      </View>
    </Card>
  );
}
