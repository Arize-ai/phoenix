import { useMemo } from "react";
import { css } from "@emotion/react";

import { Button, Flex, Heading, View } from "@phoenix/components";
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
          padding: var(--ac-global-dimension-size-200)
            var(--ac-global-dimension-size-400);
          gap: var(--ac-global-dimension-size-400);
        `}
      >
        <NewEvaluatorPageContent />
      </main>
    </EvaluatorChatTemplateProvider>
  );
};

const validateEvaluatorConfiguration = () => {
  return false;
};

const NewEvaluatorPageContent = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _state = usePlaygroundContext((state) => state.instances);
  const isValid = useMemo(() => validateEvaluatorConfiguration(), []);
  return (
    <>
      <View
        paddingBottom="size-100"
        borderColor="dark"
        borderBottomWidth="thin"
      >
        <Flex
          direction="row"
          alignItems="center"
          justifyContent="space-between"
        >
          <Heading level={2}>New Evaluator</Heading>
          <Flex direction="row" alignItems="center" gap="size-100">
            <Button size="M">Cancel</Button>
            <Button variant="primary" size="M" isDisabled={!isValid}>
              Save
            </Button>
          </Flex>
        </Flex>
      </View>
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
