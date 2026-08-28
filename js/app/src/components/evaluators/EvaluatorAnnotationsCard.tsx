import { Card, Flex, View } from "@phoenix/components";
import type { OutputConfig } from "@phoenix/components/evaluators/OutputConfigBlock";
import { OutputConfigBlock } from "@phoenix/components/evaluators/OutputConfigBlock";

/**
 * The card listing every annotation an evaluator writes, one OutputConfigBlock
 * per config. Shared by the dataset and project evaluator details pages;
 * renders nothing when the evaluator has no output configs.
 */
export function EvaluatorAnnotationsCard({
  outputConfigs,
  singularTitle,
  pluralTitle,
  includeExplanation,
}: {
  outputConfigs: ReadonlyArray<
    { readonly __typename: string } & Partial<OutputConfig>
  >;
  /** Card title when there is one config, e.g. "Evaluator Annotation". */
  singularTitle: string;
  /** Card title prefix when there are several; the count is appended. */
  pluralTitle: string;
  /** When set, each block shows whether the evaluator explains itself. */
  includeExplanation?: boolean;
}) {
  if (outputConfigs.length === 0) {
    return null;
  }

  return (
    <Card
      title={
        outputConfigs.length > 1
          ? `${pluralTitle} (${outputConfigs.length})`
          : singularTitle
      }
    >
      <View padding="size-200">
        <Flex direction="column" gap="size-200">
          {outputConfigs.map((config, idx) => {
            // The union's unknown arm ("%other") selects no fields, so the
            // block renders it as an all-defaults freeform config.
            const outputConfig = config as OutputConfig;
            return (
              <OutputConfigBlock
                key={outputConfig.name || idx}
                config={outputConfig}
                typename={config.__typename}
                includeExplanation={includeExplanation}
              />
            );
          })}
        </Flex>
      </View>
    </Card>
  );
}
