import { graphql, readInlineData, useFragment } from "react-relay";
import { css } from "@emotion/react";

import { Flex, Link, Text } from "@phoenix/components";
import { AnnotationNameAndValue } from "@phoenix/components/annotation";
import type { EvaluatorLLMConfig_evaluator$key } from "@phoenix/components/evaluators/EvaluatorConfigDialog/__generated__/EvaluatorLLMConfig_evaluator.graphql";
import type { EvaluatorLLMConfig_getOutputConfigValuesSummary_outputConfig$key } from "@phoenix/components/evaluators/EvaluatorConfigDialog/__generated__/EvaluatorLLMConfig_getOutputConfigValuesSummary_outputConfig.graphql";
import { PromptChatMessages } from "@phoenix/components/prompt/PromptChatMessagesCard";

type EvaluatorLLMConfigProps = {
  queryRef: EvaluatorLLMConfig_evaluator$key;
};

export const EvaluatorLLMConfig = ({ queryRef }: EvaluatorLLMConfigProps) => {
  const evaluator = useFragment(
    graphql`
      fragment EvaluatorLLMConfig_evaluator on Node {
        id
        ... on Evaluator {
          name
          kind
        }
        ... on LLMEvaluator {
          ...EvaluatorLLMConfig_getOutputConfigValuesSummary_outputConfig
          outputConfig {
            name
            values {
              label
              score
            }
          }
          prompt {
            id
            name
          }
          promptVersion {
            id
            templateFormat
            ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion
            ...PromptChatMessagesCard__main
          }
        }
      }
    `,
    queryRef
  );
  return (
    <>
      {evaluator.promptVersion && (
        <Flex direction="column" gap="size-100">
          <Text>
            This is in read only mode, you can{" "}
            <Link to="TODO: link to evaluator edit page when it exists">
              edit the global evaluator
            </Link>
          </Text>
          <Text size="L">Prompt</Text>
          <PromptChatMessages promptVersion={evaluator.promptVersion} />
        </Flex>
      )}
      {evaluator.outputConfig && (
        <Flex direction="column" gap="size-100">
          <Text size="L">Eval</Text>
          <Flex
            direction="row"
            alignItems="center"
            gap="size-100"
            css={css`
              color: var(--ac-global-color-grey-600);
            `}
          >
            <AnnotationNameAndValue
              annotation={{ name: evaluator.outputConfig.name }}
              displayPreference="none"
              size="XS"
              maxWidth="100%"
            />
          </Flex>
          <Text color="grey-700">
            {getOutputConfigValuesSummary(evaluator)}
          </Text>
        </Flex>
      )}
    </>
  );
};

function getOutputConfigValuesSummary(
  queryRef: EvaluatorLLMConfig_getOutputConfigValuesSummary_outputConfig$key
) {
  return readInlineData(
    graphql`
      fragment EvaluatorLLMConfig_getOutputConfigValuesSummary_outputConfig on LLMEvaluator {
        outputConfig {
          values {
            label
            score
          }
        }
      }
    `,
    queryRef
  )
    .outputConfig.values.map(
      (value) =>
        value.label + (value.score != null ? " (" + value.score + ")" : "")
    )
    .join(", ");
}
