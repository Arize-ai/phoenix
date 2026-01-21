import React from "react";
import { useShallow } from "zustand/react/shallow";

import {
  EvaluatorCategoricalChoiceConfig,
  type EvaluatorCategoricalChoiceConfigProps,
} from "@phoenix/components/evaluators/EvaluatorCategoricalChoiceConfig";
import {
  EvaluatorContinuousConfig,
  type EvaluatorContinuousConfigProps,
} from "@phoenix/components/evaluators/EvaluatorContinuousConfig";
import { useEvaluatorStore } from "@phoenix/contexts/EvaluatorContext/useEvaluatorStore";

export const EvaluatorOutputConfig = ({
  categoricalChoiceConfigProps,
  continuousConfigProps,
}: {
  categoricalChoiceConfigProps?: EvaluatorCategoricalChoiceConfigProps;
  continuousConfigProps?: EvaluatorContinuousConfigProps;
}) => {
  const { outputConfig } = useEvaluatorStore(
    useShallow((state) => ({
      outputConfig: state.outputConfig,
    }))
  );
  if (!outputConfig) {
    return null;
  }
  const kind = "values" in outputConfig ? "categorical" : "continuous";
  if (kind === "categorical") {
    return (
      <EvaluatorCategoricalChoiceConfig {...categoricalChoiceConfigProps} />
    );
  }
  return <EvaluatorContinuousConfig {...continuousConfigProps} />;
};
