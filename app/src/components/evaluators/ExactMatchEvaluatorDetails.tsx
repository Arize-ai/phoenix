import { Flex, Text } from "@phoenix/components";
import { EvaluatorInputMapping } from "@phoenix/types";

export function ExactMatchEvaluatorDetails({
  inputMapping,
}: {
  inputMapping: EvaluatorInputMapping | null;
}) {
  const expectedPath = inputMapping?.pathMapping?.expected as
    | string
    | undefined;
  const expectedLiteral = inputMapping?.literalMapping?.expected as
    | string
    | undefined;
  const actualPath = inputMapping?.pathMapping?.actual as string | undefined;
  const actualLiteral = inputMapping?.literalMapping?.actual as
    | string
    | undefined;
  const caseSensitive = inputMapping?.literalMapping?.case_sensitive;

  return (
    <Flex direction="column" gap="size-100">
      <Text size="S">
        <Text weight="heavy">Expected:</Text>{" "}
        {expectedPath ||
          (expectedLiteral ? `"${expectedLiteral}"` : "Not mapped")}
      </Text>
      <Text size="S">
        <Text weight="heavy">Actual:</Text>{" "}
        {actualPath || (actualLiteral ? `"${actualLiteral}"` : "Not mapped")}
      </Text>
      <Text size="S">
        <Text weight="heavy">Case sensitive:</Text>{" "}
        {caseSensitive === false || caseSensitive === "false" ? "No" : "Yes"}
      </Text>
    </Flex>
  );
}
