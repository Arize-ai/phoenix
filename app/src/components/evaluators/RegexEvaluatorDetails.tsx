import { Flex, Text } from "@phoenix/components";

type InputMapping = {
  pathMapping?: Record<string, unknown> | null;
  literalMapping?: Record<string, unknown> | null;
};

export function RegexEvaluatorDetails({
  inputMapping,
}: {
  inputMapping: InputMapping | null;
}) {
  const textPath = inputMapping?.pathMapping?.text as string | undefined;
  const textLiteral = inputMapping?.literalMapping?.text as string | undefined;
  const pattern = inputMapping?.literalMapping?.pattern as string | undefined;
  const fullMatch = inputMapping?.literalMapping?.full_match;

  return (
    <Flex direction="column" gap="size-100">
      <Text size="S">
        <Text weight="heavy">Pattern:</Text>{" "}
        {pattern ? `"${pattern}"` : "Not set"}
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
