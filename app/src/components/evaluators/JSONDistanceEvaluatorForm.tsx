import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

import { Flex } from "@phoenix/components";
import { useFlattenedEvaluatorInputKeys } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { EvaluatorOutputConfig } from "@phoenix/components/evaluators/EvaluatorOutputConfig";
import { JSONDistanceEvaluatorCodeBlock } from "@phoenix/components/evaluators/JSONDistanceEvaluatorCodeBlock";
import { SwitchableEvaluatorInput } from "@phoenix/components/evaluators/SwitchableEvaluatorInput";
import {
  useEvaluatorStore,
  useEvaluatorStoreInstance,
} from "@phoenix/contexts/EvaluatorContext/useEvaluatorStore";

const useJSONDistanceEvaluatorForm = () => {
  const store = useEvaluatorStoreInstance();
  const { pathMapping, literalMapping } = useEvaluatorStore(
    (state) => state.evaluator.inputMapping
  );
  const form = useForm({
    defaultValues: { pathMapping, literalMapping },
    mode: "onChange",
  });
  const subscribe = form.subscribe;
  useEffect(() => {
    return subscribe({
      formState: { isValid: true, values: true },
      callback({ values: { pathMapping, literalMapping }, isValid }) {
        if (!isValid) {
          return;
        }
        const { setPathMapping, setLiteralMapping } = store.getState();
        setPathMapping({ ...pathMapping });
        setLiteralMapping({ ...literalMapping });
      },
    });
  }, [subscribe, store]);
  return form;
};

export const JSONDistanceEvaluatorForm = () => {
  const { control, getValues, setValue } = useJSONDistanceEvaluatorForm();
  const [expectedPath, setExpectedPath] = useState<string>(
    () => getValues("pathMapping.expected") ?? ""
  );
  const [actualPath, setActualPath] = useState<string>(
    () => getValues("pathMapping.actual") ?? ""
  );
  const evaluatorMappingSource = useEvaluatorStore(
    (state) => state.evaluatorMappingSource
  );
  const allExampleKeys = useFlattenedEvaluatorInputKeys(evaluatorMappingSource);

  // Determine initial mode based on existing values
  const expectedDefaultMode =
    getValues("literalMapping.expected") != null ? "literal" : "path";
  const actualDefaultMode =
    getValues("literalMapping.actual") != null ? "literal" : "path";

  return (
    <Flex direction="column" gap="size-200">
      <Flex direction="column" gap="size-100">
        <SwitchableEvaluatorInput
          fieldName="expected"
          label="Expected"
          description="The expected JSON string."
          defaultMode={expectedDefaultMode}
          control={control}
          setValue={setValue}
          pathOptions={allExampleKeys}
          pathPlaceholder="Map an example field to Expected"
          literalPlaceholder="Enter expected JSON"
          pathInputValue={expectedPath}
          onPathInputChange={setExpectedPath}
        />
        <SwitchableEvaluatorInput
          fieldName="actual"
          label="Actual"
          description="The actual JSON string to compare."
          defaultMode={actualDefaultMode}
          control={control}
          setValue={setValue}
          pathOptions={allExampleKeys}
          pathPlaceholder="Map an example field to Actual"
          literalPlaceholder="Enter actual JSON"
          pathInputValue={actualPath}
          onPathInputChange={setActualPath}
        />
      </Flex>
      <EvaluatorOutputConfig
        categoricalChoiceConfigProps={{
          isNameDisabled: true,
          isOptimizationDirectionDisabled: false,
          isChoicesDisabled: true,
        }}
        continuousConfigProps={{
          isNameDisabled: true,
          isBoundsDisabled: true,
          isOptimizationDirectionDisabled: false,
        }}
      />
      <JSONDistanceEvaluatorCodeBlock />
    </Flex>
  );
};
