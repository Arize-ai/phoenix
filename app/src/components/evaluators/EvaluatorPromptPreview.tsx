/**
 * A component that shows a preview of the prompt that will be used for the llm evals
 **/

import { Suspense, useMemo } from "react";
import { graphql, useLazyLoadQuery } from "react-relay";
import invariant from "tiny-invariant";
import { css } from "@emotion/react";

import { Card, Flex, Loading } from "@phoenix/components";
import { EvaluatorInput } from "@phoenix/components/evaluators/utils";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { useChatMessageStyles } from "@phoenix/hooks/useChatMessageStyles";
import { ChatMessage } from "@phoenix/store/playground/types";

type EvaluatorPromptPreviewProps = {
  evaluatorInput: EvaluatorInput | null;
};

export function EvaluatorPropmtPreview(props: EvaluatorPromptPreviewProps) {
  return (
    <Suspense fallback={<Loading />}>
      <EvaluatorPromptPreviewBody {...props} />
    </Suspense>
  );
}
export function EvaluatorPromptPreviewBody(props: EvaluatorPromptPreviewProps) {
  const template = usePlaygroundContext((state) => {
    const instance = state.instances[0];
    return instance.template;
  });
  const templateFormat = usePlaygroundContext((state) => state.templateFormat);
  const data = useLazyLoadQuery<EvaluatorPromptPreviewQuery>(
    graphql`
      query EvaluatorPromptPreviewQuery(
        $template: PromptChatTemplateInput!
        $templateOptions: PromptTemplateOptions!
      ) {
        prompt: applyChatTemplateVariables(
          template: $template
          templateOptions: $templateOptions
        )
      }
    `,
    {
      template: template,
      templateOptions: {
        variables: props.evaluatorInput,
        format: templateFormat,
      },
    }
  );
  const messages = usePlaygroundContext((state) => state.allInstanceMessages);
  invariant(template.__type === "chat", "Template must be a chat template");
  return (
    <Flex direction="column" gap="size-200">
      {template.messageIds.map((messageId) => {
        const message = messages[messageId];
        return (
          <MessageCard
            message={message}
            key={messageId}
            variables={variables}
          />
        );
      })}
    </Flex>
  );
}

function MessageCard({
  message,
  variables,
}: {
  variables: Record<string, unknown>;
  message: ChatMessage;
}) {
  const styles = useChatMessageStyles(message.role);
  const templateFormat = usePlaygroundContext((state) => state.templateFormat);
  return (
    <Card title={message.role} key={message.id} {...styles}>
      <pre
        key={message.id}
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
