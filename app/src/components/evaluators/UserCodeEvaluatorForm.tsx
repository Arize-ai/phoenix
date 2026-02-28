import { useShallow } from "zustand/react/shallow";

import { Flex, Heading, Text, View } from "@phoenix/components";
import { CodeEditorFieldWrapper, PythonEditor } from "@phoenix/components/code";
import { LazyEditorWrapper } from "@phoenix/components/code/LazyEditorWrapper";
import { EvaluatorInputMapping } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext";

export const UserCodeEvaluatorForm = () => {
  const evaluatorKind = useEvaluatorStore((state) => state.evaluator.kind);
  if (evaluatorKind !== "CODE") {
    throw new Error("UserCodeEvaluatorForm called for non-CODE evaluator");
  }
  const { sourceCode, setSourceCode } = useEvaluatorStore(
    useShallow((state) => ({
      sourceCode: state.sourceCode,
      setSourceCode: state.setSourceCode,
    }))
  );
  return (
    <>
      <View marginBottom="size-200" flex="none">
        <Flex direction="column" gap="size-100">
          <Heading level={2} weight="heavy">
            Evaluator Code
          </Heading>
          <Text color="text-500">
            Write a Python function that evaluates your task output.
          </Text>
        </Flex>
      </View>
      <CodeEditorFieldWrapper label="Source Code">
        <LazyEditorWrapper preInitializationMinHeight={200}>
          <PythonEditor
            value={sourceCode}
            onChange={setSourceCode}
            height="200px"
            placeholder="def score(output: str, input: str) -> dict: ..."
          />
        </LazyEditorWrapper>
      </CodeEditorFieldWrapper>
      <Flex direction="column" gap="size-100" marginTop="size-200">
        <Heading level={2} weight="heavy">
          Map Input Variables (optional)
        </Heading>
        <Text color="text-500">
          Map the variables in your evaluator function to your dataset example
          and task output fields.
        </Text>
        <View
          backgroundColor="dark"
          borderRadius="medium"
          borderWidth="thin"
          padding="size-200"
          marginTop="size-50"
          borderColor="dark"
        >
          <EvaluatorInputMapping />
        </View>
      </Flex>
    </>
  );
};
