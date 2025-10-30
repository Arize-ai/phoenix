import { PropsWithChildren, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";
import { css } from "@emotion/react";

import { Alert, Button, Flex, Heading, Text, View } from "@phoenix/components";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import {
  EvaluatorChatTemplate,
  EvaluatorChatTemplateProvider,
} from "@phoenix/pages/evaluators/EvaluatorChatTemplate";
import { EvaluatorExampleDataset } from "@phoenix/pages/evaluators/EvaluatorExampleDataset";
import {
  EvaluatorInputMapping,
  InputMapping,
} from "@phoenix/pages/evaluators/EvaluatorInputMapping";
import {
  ChoiceConfig,
  EvaluatorLLMChoice,
} from "@phoenix/pages/evaluators/EvaluatorLLMChoice";

export const NewEvaluatorPage = () => {
  return (
    <EvaluatorChatTemplateProvider>
      <main
        css={css`
          display: flex;
          flex-direction: column;
          flex: 1 1 auto;
          height: 100%;
          // do not apply padding to the main content area
          // it will break the nested scrolling within the panel group
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

const PanelContainer = ({ children }: PropsWithChildren) => {
  return (
    <div
      css={css`
        display: flex;
        flex-direction: column;
        gap: var(--ac-global-dimension-size-200);
        padding: var(--ac-global-dimension-size-100) 0;
      `}
    >
      {children}
    </div>
  );
};

const panelCSS = css`
  padding: 0 var(--ac-global-dimension-size-200);
`;

const panelStyle = {
  height: "100%",
  overflowY: "auto",
} as const;

const NewEvaluatorPageContent = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _state = usePlaygroundContext((state) => state.instances);
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(
    null
  );
  const [selectedSplitIds, setSelectedSplitIds] = useState<string[]>([]);
  const [selectedExampleId, setSelectedExampleId] = useState<string | null>(
    null
  );
  const { control: choiceConfigControl } = useForm<ChoiceConfig>({
    defaultValues: {
      name: "correctness",
      choices: [
        { label: "Incorrect", score: 0 },
        { label: "Correct", score: 1 },
      ],
    },
  });
  const { control: inputMappingControl } = useForm<InputMapping>({
    defaultValues: {},
  });
  const isValid = useMemo(() => validateEvaluatorConfiguration(), []);
  return (
    <>
      <View
        borderColor="dark"
        borderBottomWidth="thin"
        paddingStart="size-200"
        paddingEnd="size-200"
        paddingTop="size-100"
        paddingBottom="size-100"
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
        <Panel defaultSize={65} css={panelCSS} style={panelStyle}>
          <PanelContainer>
            <Flex direction="column" gap="size-100" marginTop="size-100">
              <Heading level={3}>Eval</Heading>
              <Text color="text-500">
                Define the eval annotation returned by your evaluator.
              </Text>
              <EvaluatorLLMChoice control={choiceConfigControl} />
            </Flex>
            <Flex direction="column" gap="size-100">
              <Heading level={3}>Prompt</Heading>
              <Alert showIcon={false} variant="success">
                Tip: Your eval categories are visible to the LLM, so don&apos;t
                redefine them in your prompt. This needs to be phrased better,
                but generally we should explain what not to do for this.
              </Alert>
              <EvaluatorChatTemplate />
            </Flex>
          </PanelContainer>
        </Panel>
        <PanelResizeHandle disabled />
        <Panel defaultSize={35} css={panelCSS} style={panelStyle}>
          <PanelContainer>
            <div
              css={css`
                display: flex;
                flex-direction: column;
                gap: var(--ac-global-dimension-static-size-200);
                background-color: var(--ac-global-background-color-dark);
                border-radius: var(--ac-global-rounding-medium);
                padding: var(--ac-global-dimension-static-size-200);
                border: 1px solid var(--ac-global-border-color-default);
                margin-top: var(--ac-global-dimension-static-size-900);
              `}
            >
              <Flex direction="column" gap="size-100">
                <Heading level={3}>Test your evaluator</Heading>
                <Text color="text-500">
                  Use examples from an existing dataset as a reference, or
                  create new examples from scratch.
                </Text>
                <EvaluatorExampleDataset
                  selectedDatasetId={selectedDatasetId}
                  onSelectDataset={setSelectedDatasetId}
                  selectedSplitIds={selectedSplitIds}
                  onSelectSplits={setSelectedSplitIds}
                  onSelectExampleId={setSelectedExampleId}
                />
              </Flex>
              <EvaluatorInputMapping
                exampleId={selectedExampleId ?? undefined}
                control={inputMappingControl}
              />
            </div>
          </PanelContainer>
        </Panel>
      </PanelGroup>
    </>
  );
};
