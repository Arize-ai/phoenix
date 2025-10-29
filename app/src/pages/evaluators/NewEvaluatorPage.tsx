import { css } from "@emotion/react";

import { Heading } from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import {
  EvaluatorChatTemplate,
  EvaluatorChatTemplateProvider,
} from "@phoenix/pages/evaluators/EvaluatorChatTemplate";

export const NewEvaluatorPage = () => {
  return (
    <EvaluatorChatTemplateProvider>
      <main
        css={css`
          display: flex;
          flex-direction: column;
          padding: var(--ac-global-dimension-size-400);
          gap: var(--ac-global-dimension-size-400);
        `}
      >
        <NewEvaluatorPageContent />
      </main>
    </EvaluatorChatTemplateProvider>
  );
};

const NewEvaluatorPageContent = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _state = usePlaygroundContext((state) => state.instances);
  return (
    <>
      <Heading level={2}>New Evaluator</Heading>
      <hr />
      <div
        css={css`
          height: 400px;
          border: 1px solid var(--ac-global-border-color-default);
          border-style: dashed;
          border-radius: var(--ac-global-rounding-small);
        `}
      ></div>
      <EvaluatorChatTemplate />
    </>
  );
};
