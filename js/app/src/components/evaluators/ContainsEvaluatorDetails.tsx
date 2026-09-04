import { Flex, Text } from "@phoenix/components";
import type { EvaluatorInputMapping } from "@phoenix/types";

function getContainsEvaluatorValues(
  inputMapping: EvaluatorInputMapping | null
) {
  const pathMapping = inputMapping?.pathMapping;
  const literalMapping = inputMapping?.literalMapping;
  return {
    textPath: pathMapping?.text as string | undefined,
    textLiteral: literalMapping?.text as string | undefined,
    wordsPath: pathMapping?.words as string | undefined,
    wordsLiteral: literalMapping?.words as string | undefined,
    caseSensitive: literalMapping?.case_sensitive,
    requireAll: literalMapping?.require_all,
  };
}

export function ContainsEvaluatorDetails({
  inputMapping,
}: {
  inputMapping: EvaluatorInputMapping | null;
}) {
  const {
    textPath,
    textLiteral,
    wordsPath,
    wordsLiteral,
    caseSensitive,
    requireAll,
  } = getContainsEvaluatorValues(inputMapping);

  return (
    <Flex direction="column" gap="size-100">
      <Text size="S">
        <Text weight="heavy">Text:</Text>{" "}
        {textPath || (textLiteral ? `"${textLiteral}"` : "Not mapped")}
      </Text>
      <Text size="S">
        <Text weight="heavy">Words:</Text>{" "}
        {wordsPath || (wordsLiteral ? `"${wordsLiteral}"` : "Not set")}
      </Text>
      <Text size="S">
        <Text weight="heavy">Case sensitive:</Text>{" "}
        {caseSensitive === true || caseSensitive === "true" ? "Yes" : "No"}
      </Text>
      <Text size="S">
        <Text weight="heavy">Require all:</Text>{" "}
        {requireAll === true || requireAll === "true" ? "Yes" : "No"}
      </Text>
    </Flex>
  );
}
