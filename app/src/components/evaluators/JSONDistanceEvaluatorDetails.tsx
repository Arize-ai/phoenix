import { Flex, Text } from "@phoenix/components";

type InputMapping = {
  pathMapping?: Record<string, unknown> | null;
  literalMapping?: Record<string, unknown> | null;
};

export function JSONDistanceEvaluatorDetails({
  inputMapping,
}: {
  inputMapping: InputMapping | null;
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
    </Flex>
  );
}
