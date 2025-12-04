/**
 * A component that shows a preview of the prompt that will be used for the llm evals
 **/

import { Suspense, useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import invariant from "tiny-invariant";
import { css } from "@emotion/react";

import { Card, Flex, Icon, Icons, Text, View } from "@phoenix/components";
import { EvaluatorPromptPreviewQuery } from "@phoenix/components/evaluators/__generated__/EvaluatorPromptPreviewQuery.graphql";
import {
  EvaluatorInput,
  playgroundChatTemplateToGqlPromptChatTemplate,
} from "@phoenix/components/evaluators/utils";
import { ErrorBoundary } from "@phoenix/components/exception";
import { ErrorBoundaryFallbackProps } from "@phoenix/components/exception/types";
import { Skeleton } from "@phoenix/components/loading/Skeleton";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { useChatMessageStyles } from "@phoenix/hooks/useChatMessageStyles";
import { denormalizePlaygroundInstance } from "@phoenix/pages/playground/playgroundUtils";
import {
  ChatMessage,
  PlaygroundChatTemplate,
} from "@phoenix/store/playground/types";

type EvaluatorPromptPreviewProps = {
  evaluatorInput: EvaluatorInput | null;
};

function EvaluatorPromptPreviewSkeleton() {
  return (
    <Flex direction="column" gap="size-200">
      <Skeleton height={300} />
      <Skeleton height={300} />
    </Flex>
  );
}

function EvaluatorPromptPreviewErrorFallback(
  _props: ErrorBoundaryFallbackProps
) {
  return (
    <View padding="size-200">
      <Flex direction="row" gap="size-100" alignItems="start">
        <Icon svg={<Icons.AlertCircleOutline />} color="danger" />
        <Flex direction="column" gap="size-50">
          <Text weight="heavy" color="danger">
            Unable to render template preview
          </Text>
          <Text color="text-700">
            The template variables in your prompt may not match the available
            input mappings or parameters. Please check that all template
            variables (e.g. {"{{input}}"}, {"{{output}}"}, {"{{expected}}"})
            have corresponding values defined.
          </Text>
        </Flex>
      </Flex>
    </View>
  );
}

export function EvaluatorPromptPreview(props: EvaluatorPromptPreviewProps) {
  return (
    <ErrorBoundary fallback={EvaluatorPromptPreviewErrorFallback}>
      <Suspense fallback={<EvaluatorPromptPreviewSkeleton />}>
        <EvaluatorPromptPreviewBody {...props} />
      </Suspense>
    </ErrorBoundary>
  );
}

export function EvaluatorPromptPreviewBody(props: EvaluatorPromptPreviewProps) {
  const instance = usePlaygroundContext((state) => state.instances[0]);
  const allInstanceMessages = usePlaygroundContext(
    (state) => state.allInstanceMessages
  );
  const templateFormat = usePlaygroundContext((state) => state.templateFormat);

  // Denormalize the instance to get the full template with messages
  const denormalizedInstance = useMemo(
    () => denormalizePlaygroundInstance(instance, allInstanceMessages),
    [instance, allInstanceMessages]
  );

  invariant(
    denormalizedInstance.template.__type === "chat",
    "Template must be a chat template"
  );

  const chatTemplate = denormalizedInstance.template as PlaygroundChatTemplate;

  // Convert the playground template to a GQL template
  const gqlTemplate = useMemo(
    () => playgroundChatTemplateToGqlPromptChatTemplate(chatTemplate),
    [chatTemplate]
  );

  const data = useLazyLoadQuery<EvaluatorPromptPreviewQuery>(
    graphql`
      query EvaluatorPromptPreviewQuery(
        $template: PromptChatTemplateInput!
        $templateOptions: PromptTemplateOptions!
      ) {
        prompt: applyChatTemplate(
          template: $template
          templateOptions: $templateOptions
        ) {
          messages {
            role
            content {
              __typename
              ... on TextContentPart {
                text {
                  text
                }
              }
            }
          }
        }
      }
    `,
    {
      template: gqlTemplate,
      templateOptions: {
        // TODO: this doesn't appply the mappings. Probably will push this into the API
        variables: props.evaluatorInput ?? {},
        format: templateFormat,
      },
    }
  );

  // Display the messages with applied template variables from the query result
  return (
    <Flex direction="column" gap="size-200">
      {data.prompt.messages.map((message, index) => {
        // Extract text content from the message
        const textContent = message.content
          .map((part) => {
            if (part.__typename === "TextContentPart" && part.text) {
              return part.text.text;
            }
            return null;
          })
          .filter(Boolean)
          .join("");

        return (
          <MessageCard key={index} role={message.role} content={textContent} />
        );
      })}
    </Flex>
  );
}

function MessageCard({ role, content }: { role: string; content: string }) {
  const styles = useChatMessageStyles(role as ChatMessage["role"]);
  return (
    <Card title={role} {...styles}>
      <pre
        css={css`
          white-space: pre-wrap;
          padding-left: var(--ac-global-dimension-static-size-200);
          padding-right: var(--ac-global-dimension-static-size-200);
        `}
      >
        {content}
      </pre>
    </Card>
  );
}
