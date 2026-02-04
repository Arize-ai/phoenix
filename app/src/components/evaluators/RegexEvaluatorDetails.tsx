import { Flex, Text } from "@phoenix/components";
import { EvaluatorInputMapping } from "@phoenix/types";

export function RegexEvaluatorDetails({
  inputMapping,
}: {
  inputMapping: EvaluatorInputMapping | null;
}) {
  const textPath = inputMapping?.pathMapping?.text as string | undefined;
  const textLiteral = inputMapping?.literalMapping?.text as string | undefined;
  const patternPath = inputMapping?.pathMapping?.pattern as string | undefined;
  const patternLiteral = inputMapping?.literalMapping?.pattern as
    | string
    | undefined;
  const fullMatch = inputMapping?.literalMapping?.full_match;

  return (
    <Flex direction="column" gap="size-100">
      <Text size="S">
        <Text weight="heavy">Pattern:</Text>{" "}
        {patternPath || (patternLiteral ? `"${patternLiteral}"` : "Not set")}
      </Text>
      <Text size="S">
        <Text weight="heavy">Text:</Text>{" "}
        {textPath || (textLiteral ? `"${textLiteral}"` : "Not mapped")}
      </Text>
      <Text size="S">
        <Text weight="heavy">Full match:</Text>{" "}
        {fullMatch === true || fullMatch === "true" ? "Yes" : "No"}
      </Text>
    </Flex>
  );
}
