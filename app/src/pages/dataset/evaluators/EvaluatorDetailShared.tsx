import { css } from "@emotion/react";
import type { ReactNode } from "react";

import { Flex, Heading, Text } from "@phoenix/components";
import { Truncate } from "@phoenix/components/utility/Truncate";

export const boxCSS = css`
  background-color: var(--global-background-color-dark);
  border-radius: var(--global-rounding-medium);
  padding: var(--global-dimension-static-size-200);
  margin-top: var(--global-dimension-static-size-50);
  border: 1px solid var(--global-border-color-default);
  overflow: hidden;
`;

export function Section({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <Flex direction="column" gap="size-100">
      <Heading level={2}>{title}</Heading>
      <div css={boxCSS}>{children}</div>
    </Flex>
  );
}

export type OutputConfig = {
  name: string;
  optimizationDirection?: string | null;
  values?: Array<{ label?: string | null; score?: number | null }> | null;
  lowerBound?: number | null;
  upperBound?: number | null;
};

export function OutputConfigCard({ config }: { config: OutputConfig }) {
  const isCategorical = config.values != null;
  const direction = config.optimizationDirection
    ? config.optimizationDirection.charAt(0).toUpperCase() +
      config.optimizationDirection.slice(1).toLowerCase()
    : null;

  return (
    <div css={boxCSS}>
      <Flex direction="column" gap="size-100">
        <Truncate title={config.name}>
          <Text size="S">
            <Text weight="heavy">Name:</Text> {config.name}
          </Text>
        </Truncate>
        {direction && (
          <Text size="S">
            <Text weight="heavy">Optimization Direction:</Text> {direction}
          </Text>
        )}
        {isCategorical && config.values && config.values.length > 0 && (
          <Text size="S">
            <Text weight="heavy">Values:</Text>{" "}
            {config.values
              .map((v) => `${v.label}${v.score != null ? ` (${v.score})` : ""}`)
              .join(", ")}
          </Text>
        )}
        {!isCategorical && (
          <>
            <Text size="S">
              <Text weight="heavy">Lower Bound:</Text>{" "}
              {config.lowerBound != null
                ? String(config.lowerBound)
                : "Unbounded"}
            </Text>
            <Text size="S">
              <Text weight="heavy">Upper Bound:</Text>{" "}
              {config.upperBound != null
                ? String(config.upperBound)
                : "Unbounded"}
            </Text>
          </>
        )}
      </Flex>
    </div>
  );
}

export function OutputConfigsSection({
  configs,
}: {
  configs: readonly OutputConfig[];
}) {
  if (configs.length === 0) return null;

  const title =
    configs.length === 1
      ? "Evaluator Annotation"
      : `Evaluator Annotations (${configs.length})`;

  return (
    <Flex direction="column" gap="size-100">
      <Heading level={2}>{title}</Heading>
      {configs.map((config, idx) => (
        <OutputConfigCard key={config.name || idx} config={config} />
      ))}
    </Flex>
  );
}
