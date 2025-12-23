import { useFragment } from "react-relay";
import { useRevalidator } from "react-router";
import { graphql } from "relay-runtime";
import { css } from "@emotion/react";

import { Flex, Heading, Text, View } from "@phoenix/components";
import { EditBuiltInDatasetEvaluatorSlideover } from "@phoenix/components/dataset/EditBuiltInDatasetEvaluatorSlideover";
import { ContainsEvaluatorCodeBlock } from "@phoenix/components/evaluators/ContainsEvaluatorCodeBlock";
import { BuiltInDatasetEvaluatorDetails_datasetEvaluator$key } from "@phoenix/pages/dataset/evaluators/__generated__/BuiltInDatasetEvaluatorDetails_datasetEvaluator.graphql";

export function BuiltInDatasetEvaluatorDetails({
  datasetEvaluatorRef,
  datasetId,
  isEditSlideoverOpen,
  onEditSlideoverOpenChange,
}: {
  datasetEvaluatorRef: BuiltInDatasetEvaluatorDetails_datasetEvaluator$key;
  datasetId: string;
  isEditSlideoverOpen: boolean;
  onEditSlideoverOpenChange: (isOpen: boolean) => void;
}) {
  // this is so evaluator name updates are reflected in the breadcrumbs
  const { revalidate } = useRevalidator();
  const datasetEvaluator = useFragment(
    graphql`
      fragment BuiltInDatasetEvaluatorDetails_datasetEvaluator on DatasetEvaluator {
        id
        inputMapping {
          literalMapping
          pathMapping
        }
        evaluator {
          kind
          name
          isBuiltin
        }
      }
    `,
    datasetEvaluatorRef
  );

  const evaluator = datasetEvaluator.evaluator;
  const inputMapping = datasetEvaluator.inputMapping;

  if (evaluator.kind !== "CODE") {
    throw new Error(
      "BuiltInDatasetEvaluatorDetails called for non-CODE evaluator"
    );
  }

  if (evaluator.isBuiltin && evaluator.name) {
    switch (evaluator.name.toLowerCase()) {
      case "contains": {
        return (
          <>
            <ContainsEvaluatorDetails inputMapping={inputMapping} />
            <EditBuiltInDatasetEvaluatorSlideover
              datasetEvaluatorId={datasetEvaluator.id}
              datasetId={datasetId}
              isOpen={isEditSlideoverOpen}
              onOpenChange={onEditSlideoverOpenChange}
              onEvaluatorUpdated={() => revalidate()}
            />
          </>
        );
      }
    }
  }

  throw new Error(
    "Unknown built-in evaluator or code evaluator not implemented"
  );
}

function ContainsEvaluatorDetails({
  inputMapping,
}: {
  inputMapping: {
    literalMapping?: {
      words?: string | null;
      case_sensitive?: boolean | string | null;
    } | null;
    pathMapping?: {
      text?: string | null;
    } | null;
  } | null;
}) {
  const textPath = inputMapping?.pathMapping?.text;
  const words = inputMapping?.literalMapping?.words;
  const caseSensitive = inputMapping?.literalMapping?.case_sensitive;

  return (
    <View padding="size-200" overflow="auto">
      <Flex direction="column" gap="size-200">
        <ContainsEvaluatorCodeBlock />
        <Flex direction="column" gap="size-100">
          <Heading level={2}>Input Mapping</Heading>
          <div
            css={css`
              background-color: var(--ac-global-background-color-dark);
              border-radius: var(--ac-global-rounding-medium);
              padding: var(--ac-global-dimension-static-size-200);
              margin-top: var(--ac-global-dimension-static-size-50);
              border: 1px solid var(--ac-global-border-color-default);
            `}
          >
            <Flex direction="column" gap="size-100">
              <Text size="S">
                <Text weight="heavy">Text:</Text> {textPath || "Not mapped"}
              </Text>
              <Text size="S">
                <Text weight="heavy">Words:</Text>{" "}
                {words ? String(words) : "Not set"}
              </Text>
              <Text size="S">
                <Text weight="heavy">Case sensitive:</Text>{" "}
                {caseSensitive === true || caseSensitive === "true"
                  ? "Yes"
                  : "No"}
              </Text>
            </Flex>
          </div>
        </Flex>
      </Flex>
    </View>
  );
}
