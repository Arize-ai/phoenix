import { useFragment } from "react-relay";
import { useRevalidator } from "react-router";
import { graphql } from "relay-runtime";
import { css } from "@emotion/react";

import { Flex, Heading, Text, View } from "@phoenix/components";
import { EditBuiltInDatasetEvaluatorSlideover } from "@phoenix/components/dataset/EditBuiltInDatasetEvaluatorSlideover";
import { ContainsEvaluatorCodeBlock } from "@phoenix/components/evaluators/ContainsEvaluatorCodeBlock";
import { ExactMatchEvaluatorCodeBlock } from "@phoenix/components/evaluators/ExactMatchEvaluatorCodeBlock";
import { JSONDistanceEvaluatorCodeBlock } from "@phoenix/components/evaluators/JSONDistanceEvaluatorCodeBlock";
import { LevenshteinDistanceEvaluatorCodeBlock } from "@phoenix/components/evaluators/LevenshteinDistanceEvaluatorCodeBlock";
import { RegexEvaluatorCodeBlock } from "@phoenix/components/evaluators/RegexEvaluatorCodeBlock";
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
    const editSlideover = (
      <EditBuiltInDatasetEvaluatorSlideover
        datasetEvaluatorId={datasetEvaluator.id}
        datasetId={datasetId}
        isOpen={isEditSlideoverOpen}
        onOpenChange={onEditSlideoverOpenChange}
        onUpdate={() => revalidate()}
      />
    );

    switch (evaluator.name.toLowerCase()) {
      case "contains": {
        return (
          <>
            <ContainsEvaluatorDetails inputMapping={inputMapping} />
            {editSlideover}
          </>
        );
      }
      case "exactmatch": {
        return (
          <>
            <ExactMatchEvaluatorDetails inputMapping={inputMapping} />
            {editSlideover}
          </>
        );
      }
      case "regex": {
        return (
          <>
            <RegexEvaluatorDetails inputMapping={inputMapping} />
            {editSlideover}
          </>
        );
      }
      case "levenshteindistance": {
        return (
          <>
            <LevenshteinDistanceEvaluatorDetails inputMapping={inputMapping} />
            {editSlideover}
          </>
        );
      }
      case "jsondistance": {
        return (
          <>
            <JSONDistanceEvaluatorDetails inputMapping={inputMapping} />
            {editSlideover}
          </>
        );
      }
    }
  }

  throw new Error(
    "Unknown built-in evaluator or code evaluator not implemented"
  );
}

const inputMappingBoxCSS = css`
  background-color: var(--ac-global-background-color-dark);
  border-radius: var(--ac-global-rounding-medium);
  padding: var(--ac-global-dimension-static-size-200);
  margin-top: var(--ac-global-dimension-static-size-50);
  border: 1px solid var(--ac-global-border-color-default);
`;

function ContainsEvaluatorDetails({
  inputMapping,
}: {
  inputMapping: {
    literalMapping?: {
      text?: string | null;
      words?: string | null;
      case_sensitive?: boolean | string | null;
      require_all?: boolean | string | null;
    } | null;
    pathMapping?: {
      text?: string | null;
      words?: string | null;
    } | null;
  } | null;
}) {
  const textPath = inputMapping?.pathMapping?.text;
  const textLiteral = inputMapping?.literalMapping?.text;
  const wordsPath = inputMapping?.pathMapping?.words;
  const wordsLiteral = inputMapping?.literalMapping?.words;
  const caseSensitive = inputMapping?.literalMapping?.case_sensitive;
  const requireAll = inputMapping?.literalMapping?.require_all;

  return (
    <View padding="size-200" overflow="auto">
      <Flex direction="column" gap="size-200">
        <Flex direction="column" gap="size-100">
          <Heading level={2}>Input Mapping</Heading>
          <div css={inputMappingBoxCSS}>
            <Flex direction="column" gap="size-100">
              <Text size="S">
                <Text weight="heavy">Text:</Text>{" "}
                {textPath
                  ? textPath
                  : textLiteral != null
                    ? `"${textLiteral}"`
                    : "Not mapped"}
              </Text>
              <Text size="S">
                <Text weight="heavy">Words:</Text>{" "}
                {wordsPath
                  ? wordsPath
                  : wordsLiteral
                    ? String(wordsLiteral)
                    : "Not set"}
              </Text>
              <Text size="S">
                <Text weight="heavy">Case sensitive:</Text>{" "}
                {caseSensitive === true || caseSensitive === "true"
                  ? "Yes"
                  : "No"}
              </Text>
              <Text size="S">
                <Text weight="heavy">Require all words:</Text>{" "}
                {requireAll === true || requireAll === "true" ? "Yes" : "No"}{" "}
                (not implemented!)
              </Text>
            </Flex>
          </div>
        </Flex>
        <ContainsEvaluatorCodeBlock />
      </Flex>
    </View>
  );
}

function ExactMatchEvaluatorDetails({
  inputMapping,
}: {
  inputMapping: {
    literalMapping?: {
      expected?: string | null;
      actual?: string | null;
      case_sensitive?: boolean | string | null;
    } | null;
    pathMapping?: {
      expected?: string | null;
      actual?: string | null;
    } | null;
  } | null;
}) {
  const expectedPath = inputMapping?.pathMapping?.expected;
  const expectedLiteral = inputMapping?.literalMapping?.expected;
  const actualPath = inputMapping?.pathMapping?.actual;
  const actualLiteral = inputMapping?.literalMapping?.actual;
  const caseSensitive = inputMapping?.literalMapping?.case_sensitive;

  return (
    <View padding="size-200" overflow="auto">
      <Flex direction="column" gap="size-200">
        <Flex direction="column" gap="size-100">
          <Heading level={2}>Input Mapping</Heading>
          <div css={inputMappingBoxCSS}>
            <Flex direction="column" gap="size-100">
              <Text size="S">
                <Text weight="heavy">Expected:</Text>{" "}
                {expectedPath
                  ? expectedPath
                  : expectedLiteral != null
                    ? `"${expectedLiteral}"`
                    : "Not mapped"}
              </Text>
              <Text size="S">
                <Text weight="heavy">Actual:</Text>{" "}
                {actualPath
                  ? actualPath
                  : actualLiteral != null
                    ? `"${actualLiteral}"`
                    : "Not mapped"}
              </Text>
              <Text size="S">
                <Text weight="heavy">Case sensitive:</Text>{" "}
                {caseSensitive === false || caseSensitive === "false"
                  ? "No"
                  : "Yes"}
              </Text>
            </Flex>
          </div>
        </Flex>
        <ExactMatchEvaluatorCodeBlock />
      </Flex>
    </View>
  );
}

function RegexEvaluatorDetails({
  inputMapping,
}: {
  inputMapping: {
    literalMapping?: {
      text?: string | null;
      pattern?: string | null;
      full_match?: boolean | string | null;
    } | null;
    pathMapping?: {
      text?: string | null;
    } | null;
  } | null;
}) {
  const textPath = inputMapping?.pathMapping?.text;
  const textLiteral = inputMapping?.literalMapping?.text;
  const pattern = inputMapping?.literalMapping?.pattern;
  const fullMatch = inputMapping?.literalMapping?.full_match;

  return (
    <View padding="size-200" overflow="auto">
      <Flex direction="column" gap="size-200">
        <Flex direction="column" gap="size-100">
          <Heading level={2}>Input Mapping</Heading>
          <div css={inputMappingBoxCSS}>
            <Flex direction="column" gap="size-100">
              <Text size="S">
                <Text weight="heavy">Text:</Text>{" "}
                {textPath
                  ? textPath
                  : textLiteral != null
                    ? `"${textLiteral}"`
                    : "Not mapped"}
              </Text>
              <Text size="S">
                <Text weight="heavy">Pattern:</Text>{" "}
                {pattern ? String(pattern) : "Not set"}
              </Text>
              <Text size="S">
                <Text weight="heavy">Full match:</Text>{" "}
                {fullMatch === true || fullMatch === "true" ? "Yes" : "No"}
              </Text>
            </Flex>
          </div>
        </Flex>
        <RegexEvaluatorCodeBlock />
      </Flex>
    </View>
  );
}

function LevenshteinDistanceEvaluatorDetails({
  inputMapping,
}: {
  inputMapping: {
    literalMapping?: {
      expected?: string | null;
      actual?: string | null;
      case_sensitive?: boolean | string | null;
    } | null;
    pathMapping?: {
      expected?: string | null;
      actual?: string | null;
    } | null;
  } | null;
}) {
  const expectedPath = inputMapping?.pathMapping?.expected;
  const expectedLiteral = inputMapping?.literalMapping?.expected;
  const actualPath = inputMapping?.pathMapping?.actual;
  const actualLiteral = inputMapping?.literalMapping?.actual;
  const caseSensitive = inputMapping?.literalMapping?.case_sensitive;

  return (
    <View padding="size-200" overflow="auto">
      <Flex direction="column" gap="size-200">
        <Flex direction="column" gap="size-100">
          <Heading level={2}>Input Mapping</Heading>
          <div css={inputMappingBoxCSS}>
            <Flex direction="column" gap="size-100">
              <Text size="S">
                <Text weight="heavy">Expected:</Text>{" "}
                {expectedPath
                  ? expectedPath
                  : expectedLiteral != null
                    ? `"${expectedLiteral}"`
                    : "Not mapped"}
              </Text>
              <Text size="S">
                <Text weight="heavy">Actual:</Text>{" "}
                {actualPath
                  ? actualPath
                  : actualLiteral != null
                    ? `"${actualLiteral}"`
                    : "Not mapped"}
              </Text>
              <Text size="S">
                <Text weight="heavy">Case sensitive:</Text>{" "}
                {caseSensitive === false || caseSensitive === "false"
                  ? "No"
                  : "Yes"}
              </Text>
            </Flex>
          </div>
        </Flex>
        <LevenshteinDistanceEvaluatorCodeBlock />
      </Flex>
    </View>
  );
}

function JSONDistanceEvaluatorDetails({
  inputMapping,
}: {
  inputMapping: {
    literalMapping?: {
      expected?: string | null;
      actual?: string | null;
    } | null;
    pathMapping?: {
      expected?: string | null;
      actual?: string | null;
    } | null;
  } | null;
}) {
  const expectedPath = inputMapping?.pathMapping?.expected;
  const expectedLiteral = inputMapping?.literalMapping?.expected;
  const actualPath = inputMapping?.pathMapping?.actual;
  const actualLiteral = inputMapping?.literalMapping?.actual;

  return (
    <View padding="size-200" overflow="auto">
      <Flex direction="column" gap="size-200">
        <Flex direction="column" gap="size-100">
          <Heading level={2}>Input Mapping</Heading>
          <div css={inputMappingBoxCSS}>
            <Flex direction="column" gap="size-100">
              <Text size="S">
                <Text weight="heavy">Expected:</Text>{" "}
                {expectedPath
                  ? expectedPath
                  : expectedLiteral != null
                    ? `"${expectedLiteral}"`
                    : "Not mapped"}
              </Text>
              <Text size="S">
                <Text weight="heavy">Actual:</Text>{" "}
                {actualPath
                  ? actualPath
                  : actualLiteral != null
                    ? `"${actualLiteral}"`
                    : "Not mapped"}
              </Text>
            </Flex>
          </div>
        </Flex>
        <JSONDistanceEvaluatorCodeBlock />
      </Flex>
    </View>
  );
}
