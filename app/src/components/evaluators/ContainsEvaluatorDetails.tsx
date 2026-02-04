import { Flex, Text } from "@phoenix/components";
import { EvaluatorInputMapping } from "@phoenix/types";

export function ContainsEvaluatorDetails({
  inputMapping,
}: {
  inputMapping: EvaluatorInputMapping | null;
}) {
  const textPath = inputMapping?.pathMapping?.text as string | undefined;
  const textLiteral = inputMapping?.literalMapping?.text as string | undefined;
  const wordsPath = inputMapping?.pathMapping?.words as string | undefined;
  const wordsLiteral = inputMapping?.literalMapping?.words as
    | string
    | undefined;
  const caseSensitive = inputMapping?.literalMapping?.case_sensitive;

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
    </Flex>
  );
}
