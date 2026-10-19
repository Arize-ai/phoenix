import { css } from "@emotion/react";

import { Card, Flex, Text, View } from "@phoenix/components";
import { isStringKeyedObject } from "@phoenix/typeUtils";

/** Keep provider-native result semantics visible; never normalize scores to 0–1. */
export function DecisionResult({ output }: { output: string }) {
  const result: unknown = JSON.parse(output);
  const answers =
    isStringKeyedObject(result) && isStringKeyedObject(result.answers)
      ? result.answers
      : {};
  const usage =
    isStringKeyedObject(result) && isStringKeyedObject(result.usage)
      ? result.usage
      : {};
  return (
    <Flex direction="column" gap="size-200">
      <ul
        style={{ listStyle: "none", margin: 0, padding: 0 }}
        aria-label="Decision answers"
      >
        {Object.entries(answers).map(([name, answer]) => {
          if (!isStringKeyedObject(answer)) return null;
          const value =
            answer.choice ?? answer.noul ?? answer.probability ?? answer.score;
          const isRefusal = answer.type === "refusal";
          const confidence =
            typeof answer.confidence === "number" ? answer.confidence : null;
          return (
            <li key={name}>
              <View
                paddingY="size-100"
                borderBottomWidth="thin"
                borderBottomColor="default"
              >
                <Flex
                  direction="row"
                  justifyContent="space-between"
                  alignItems="center"
                  gap="size-200"
                >
                  <Flex direction="column" gap="size-50">
                    <Text weight="heavy">{name}</Text>
                    <Text size="S" color="text-700">
                      {typeof answer.type === "string" ? answer.type : "Answer"}
                      {confidence != null
                        ? ` · confidence ${Math.round(confidence * 100)}%`
                        : ""}
                    </Text>
                  </Flex>
                  <Text weight="heavy">
                    {isRefusal
                      ? "Refused"
                      : typeof value === "string" || typeof value === "number"
                        ? String(value)
                        : "See raw response"}
                  </Text>
                </Flex>
              </View>
            </li>
          );
        })}
      </ul>
      <Text size="S" color="text-700">
        {typeof usage.input_tokens === "number"
          ? `Input tokens: ${usage.input_tokens}`
          : "Input tokens: unknown"}
        {typeof usage.output_tokens === "number"
          ? ` · Output tokens: ${usage.output_tokens}`
          : " · Output tokens: unknown"}
      </Text>
      <Card title="Raw response" collapsible defaultOpen={false}>
        <View padding="size-200">
          <pre
            css={css`
              white-space: pre-wrap;
              overflow-wrap: anywhere;
              margin: 0;
              font-family: var(--global-font-family-mono);
            `}
            aria-label="Decision result"
          >
            {output}
          </pre>
        </View>
      </Card>
    </Flex>
  );
}
