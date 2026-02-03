import { Flex, Text } from "@phoenix/components";

type InputMapping = {
  pathMapping?: Record<string, unknown> | null;
  literalMapping?: Record<string, unknown> | null;
};

export function ContainsEvaluatorDetails({
  inputMapping,
}: {
  inputMapping: InputMapping | null;
}) {
  const textPath = inputMapping?.pathMapping?.text as string | undefined;
  const textLiteral = inputMapping?.literalMapping?.text as string | undefined;
  const words = inputMapping?.literalMapping?.words as string | undefined;
  const caseSensitive = inputMapping?.literalMapping?.case_sensitive;

  return (
    <Flex direction="column" gap="size-100">
      <Text size="S">
        <Text weight="heavy">Text:</Text>{" "}
        {textPath || (textLiteral ? `"${textLiteral}"` : "Not mapped")}
      </Text>
      <Text size="S">
        <Text weight="heavy">Words:</Text> {words ? `"${words}"` : "Not set"}
      </Text>
      <Text size="S">
        <Text weight="heavy">Case sensitive:</Text>{" "}
        {caseSensitive === true || caseSensitive === "true" ? "Yes" : "No"}
      </Text>
    </Flex>
  );
}
