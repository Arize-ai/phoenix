import { useFragment } from "react-relay";
import { graphql } from "relay-runtime";

import {
  Card,
  Flex,
  Icon,
  Icons,
  LinkButton,
  Text,
  View,
} from "@phoenix/components";
import { EvaluatorInputMappingDetails } from "@phoenix/components/evaluators/EvaluatorDetailsSection";
import { GenerativeProviderIcon } from "@phoenix/components/generative/GenerativeProviderIcon";
import { PromptChatMessages } from "@phoenix/components/prompt/PromptChatMessagesCard";
import { PromptLink } from "@phoenix/pages/evaluators/PromptCell";
import { readPromptInvocationParameters } from "@phoenix/pages/playground/PromptInvocationParametersReadableFragment";
import type { LLMProjectEvaluatorDetails_projectEvaluator$key } from "@phoenix/pages/project/evaluators/__generated__/LLMProjectEvaluatorDetails_projectEvaluator.graphql";
import { safelyStringifyJSON } from "@phoenix/utils/jsonUtils";

/**
 * The prompt an LLM project evaluator runs and the span-to-prompt input mapping
 * it runs it with. The annotation it produces renders in the overview's aside
 * -- see AnnotationConfigurationCard.
 */
export function LLMProjectEvaluatorDetails({
  projectEvaluatorRef,
}: {
  projectEvaluatorRef: LLMProjectEvaluatorDetails_projectEvaluator$key;
}) {
  const projectEvaluator = useFragment(
    graphql`
      fragment LLMProjectEvaluatorDetails_projectEvaluator on ProjectEvaluator {
        inputMapping {
          literalMapping
          pathMapping
        }
        evaluator {
          kind
          ... on LLMEvaluator {
            prompt {
              id
              name
            }
            promptVersion {
              modelName
              modelProvider
              invocationParameters {
                ...PromptInvocationParametersReadableFragment
              }
              ...PromptChatMessagesCard__main
            }
            promptVersionTag {
              name
            }
          }
        }
      }
    `,
    projectEvaluatorRef
  );

  const evaluator = projectEvaluator.evaluator;
  const inputMapping = projectEvaluator.inputMapping;

  if (evaluator.kind !== "LLM") {
    throw new Error("LLMProjectEvaluatorDetails called for non-LLM evaluator");
  }

  const invocationParameters = readPromptInvocationParameters(
    evaluator.promptVersion?.invocationParameters
  )?.parameters;
  const invocationParameterEntries = Object.entries(
    invocationParameters ?? {}
  ).filter(([, value]) => value != null);
  const playgroundUrl = evaluator.prompt?.id
    ? `/playground?promptId=${encodeURIComponent(evaluator.prompt.id)}${
        evaluator.promptVersionTag?.name
          ? `&promptTagName=${encodeURIComponent(evaluator.promptVersionTag.name)}`
          : ""
      }`
    : null;
  const modelExtra = evaluator.promptVersion?.modelName ? (
    <Flex alignItems="center" gap="size-50">
      <GenerativeProviderIcon
        provider={evaluator.promptVersion.modelProvider}
        height={14}
      />
      <Text size="S" color="text-700">
        {evaluator.promptVersion.modelName}
      </Text>
    </Flex>
  ) : null;
  const playgroundExtra = playgroundUrl ? (
    <LinkButton
      to={playgroundUrl}
      size="S"
      leadingVisual={<Icon svg={<Icons.PlayCircle />} />}
      aria-label="Open evaluator prompt in Playground"
    >
      Playground
    </LinkButton>
  ) : null;

  // No wrapper: the page's overview column owns the stacking and gap.
  return (
    <>
      <Card
        title="Prompt"
        // A rubric runs long enough to dominate the page, so it folds away --
        // matching PromptChatMessagesCard, which made the same call. The title
        // holds a link, so the toggle is the arrow alone rather than wrapping
        // it, and it gets its own label instead of borrowing the link's.
        collapsible
        interactiveTitle
        collapseButtonLabel="Toggle prompt template"
        titleExtra={
          evaluator.prompt?.id && evaluator.prompt.name ? (
            <PromptLink
              promptId={evaluator.prompt.id}
              promptName={evaluator.prompt.name}
              promptVersionTag={evaluator.promptVersionTag?.name}
              nameMaxWidth="24rem"
            />
          ) : undefined
        }
        extra={
          modelExtra || playgroundExtra ? (
            <Flex alignItems="center" gap="size-100">
              {modelExtra}
              {playgroundExtra}
            </Flex>
          ) : undefined
        }
      >
        <View padding="size-200">
          <Flex direction="column" gap="size-100">
            {invocationParameterEntries.length > 0 && (
              <Flex justifyContent="end" gap="size-100" wrap>
                {invocationParameterEntries.map(([name, value]) => (
                  <Text key={name} size="XS" color="text-700" fontFamily="mono">
                    {name}:{" "}
                    {typeof value === "string"
                      ? value
                      : (safelyStringifyJSON(value).json ?? "")}
                  </Text>
                ))}
              </Flex>
            )}
            {evaluator.promptVersion && (
              <PromptChatMessages promptVersion={evaluator.promptVersion} />
            )}
          </Flex>
        </View>
      </Card>
      <EvaluatorInputMappingDetails inputMapping={inputMapping} />
    </>
  );
}
