import { useMemo } from "react";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { css } from "@emotion/react";

import { Alert, Button, Flex, Heading, Text, View } from "@phoenix/components";
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
          padding: var(--ac-global-dimension-size-200)
            var(--ac-global-dimension-size-400);
          display: flex;
          flex-direction: column;
          flex: 1 1 auto;
          gap: var(--ac-global-dimension-size-200);
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
      <PanelGroup direction="horizontal">
        <Panel
          defaultSize={65}
          css={css`
            display: flex;
            flex-direction: column;
            gap: var(--ac-global-dimension-size-400);
          `}
        >
          <Flex direction="column" gap="size-100">
            <Heading level={3}>Eval</Heading>
            <Text color="text-500">
              Define the eval annotation returned by your evaluator.
            </Text>
            <div
              css={css`
                height: 400px;
                border: 1px solid var(--ac-global-border-color-default);
                border-style: dashed;
                border-radius: var(--ac-global-rounding-small);
              `}
            ></div>
          </Flex>

          <Flex direction="column" gap="size-100">
            <Heading level={3}>Prompt</Heading>
            <Alert showIcon={false} variant="success">
              Tip: Your eval categories are visible to the LLM, so don’t
              redefine them in your prompt. This needs to be phrased better, but
              generally we should explain what not to do for this.
            </Alert>
            <EvaluatorChatTemplate />
          </Flex>
        </Panel>
        <PanelResizeHandle
          disabled
          css={css(`margin: 0 var(--ac-global-dimension-size-200)`)}
        />
        <Panel defaultSize={35}>
          <Flex direction="column" gap="size-100">
            <Heading level={3}>Example dataset</Heading>
            <Text color="text-500">
              Use examples from an existing dataset as a reference, or create
              new examples from scratch.
            </Text>
            <div
              css={css`
                height: 400px;
                border: 1px solid var(--ac-global-border-color-default);
                border-style: dashed;
                border-radius: var(--ac-global-rounding-small);
              `}
            ></div>
          </Flex>
        </Panel>
      </PanelGroup>
    </>
  );
};
