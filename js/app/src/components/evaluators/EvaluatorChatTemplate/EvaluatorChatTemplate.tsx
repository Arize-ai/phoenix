import { css } from "@emotion/react";
import { Suspense, useMemo } from "react";

import { Flex, View } from "@phoenix/components";
import { materializeEvaluatorContext } from "@phoenix/components/evaluators/evaluatorContext";
import { InstancePromptMenu } from "@phoenix/components/playground/InstancePromptMenu";
import { PlaygroundInstanceModelControls } from "@phoenix/components/playground/model";
import {
  AddMessageButton,
  ChatTemplateFooter,
  ChatTemplateMessages,
} from "@phoenix/components/playground/template";
import { TemplateEvaluatorContextProvider } from "@phoenix/components/templateEditor/TemplateEvaluatorContext";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";
import { usePlaygroundContext } from "@phoenix/contexts/PlaygroundContext";
import { extractPathsFromDatasetExamples } from "@phoenix/utils/objectUtils";

const promptMenuContainerCSS = css`
  overflow: hidden;
`;

export const EvaluatorChatTemplate = () => {
  const instances = usePlaygroundContext((state) => state.instances);
  const instanceId = instances[0].id;
  const evaluatorMappingSource = useEvaluatorStore(
    (state) => state.evaluatorMappingSource
  );
  const inputMapping = useEvaluatorStore(
    (state) => state.evaluator.inputMapping
  );
  const example = evaluatorMappingSource.source;
  const availablePaths = useMemo(() => {
    return extractPathsFromDatasetExamples(
      [
        {
          input: example.input,
          taskOutput: example.output,
          metadata: "metadata" in example ? example.metadata : {},
          ...("reference" in example ? { reference: example.reference } : {}),
        },
      ],
      null
    );
  }, [example]);
  // A dataset evaluator's template has no record behind it, so it keeps the
  // flat path list; a project evaluator's completes what it actually receives.
  const evaluationContext = useMemo(() => {
    const recordKind = evaluatorMappingSource.recordKind;
    return recordKind === "dataset"
      ? null
      : materializeEvaluatorContext({
          recordKind,
          evaluatorMappingSource,
          inputMapping,
        });
  }, [evaluatorMappingSource, inputMapping]);
  return (
    <TemplateEvaluatorContextProvider value={evaluationContext}>
      <Flex direction="row" justifyContent="space-between">
        <Flex
          direction="row"
          gap="size-100"
          alignItems="center"
          marginEnd="size-100"
          minWidth={0}
          flex="1 1 auto"
          css={promptMenuContainerCSS}
        >
          <InstancePromptMenu instanceId={instanceId} />
        </Flex>
        <Flex direction="row" gap="size-100" flex="none">
          <PlaygroundInstanceModelControls
            instanceId={instanceId}
            routing="configured"
          />
        </Flex>
      </Flex>
      <View paddingY="size-100">
        <Suspense>
          <ChatTemplateMessages
            playgroundInstanceId={instanceId}
            availablePaths={availablePaths}
          />
          <ChatTemplateFooter>
            <AddMessageButton instanceId={instanceId} />
          </ChatTemplateFooter>
        </Suspense>
      </View>
    </TemplateEvaluatorContextProvider>
  );
};
