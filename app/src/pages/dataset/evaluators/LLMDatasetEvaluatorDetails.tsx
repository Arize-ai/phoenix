import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import { Flex, Text, View } from "@phoenix/components";
import { EvaluatorPlaygroundProvider } from "@phoenix/components/evaluators/EvaluatorPlaygroundProvider";
import { EvaluatorPromptPreview } from "@phoenix/components/evaluators/EvaluatorPromptPreview";
import { EvaluatorStoreProvider } from "@phoenix/contexts/EvaluatorContext";
import { LLMDatasetEvaluatorDetails_evaluator$key } from "@phoenix/pages/dataset/evaluators/__generated__/LLMDatasetEvaluatorDetails_evaluator.graphql";
import { DEFAULT_LLM_EVALUATOR_STORE_VALUES } from "@phoenix/store/evaluatorStore";

export function LLMDatasetEvaluatorDetails({
  evaluatorRef,
}: {
  evaluatorRef: LLMDatasetEvaluatorDetails_evaluator$key;
}) {
  const evaluator = useFragment(
    graphql`
      fragment LLMDatasetEvaluatorDetails_evaluator on LLMEvaluator {
        kind
        prompt {
          id
          name
        }
        promptVersion {
          ...fetchPlaygroundPrompt_promptVersionToInstance_promptVersion
        }
        promptVersionTag {
          name
        }
      }
    `,
    evaluatorRef
  );

  return (
    <EvaluatorPlaygroundProvider
      promptId={evaluator.prompt?.id}
      promptName={evaluator.prompt?.name}
      promptVersionRef={evaluator.promptVersion ?? undefined}
      promptVersionTag={evaluator.promptVersionTag?.name}
    >
      <EvaluatorStoreProvider
        initialState={{
          ...DEFAULT_LLM_EVALUATOR_STORE_VALUES,
          evaluator: {
            ...DEFAULT_LLM_EVALUATOR_STORE_VALUES.evaluator,
            inputMapping: {
              literalMapping: {
                input: "Sample input",
                output: "Sample output",
                expected: "Sample expected",
              },
              pathMapping: {},
            },
          },
        }}
      >
        <View padding="size-200" overflow="auto">
          <Flex direction="column" gap="size-100">
            <Text size="M">Evaluator Type: {evaluator.kind}</Text>
            <EvaluatorPromptPreview />
          </Flex>
        </View>
      </EvaluatorStoreProvider>
    </EvaluatorPlaygroundProvider>
  );
}
