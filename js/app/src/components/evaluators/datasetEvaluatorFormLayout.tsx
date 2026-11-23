import type { ReactNode } from "react";

import { Counter, Text } from "@phoenix/components";
import { EvaluatorDatasetTestPanel } from "@phoenix/components/evaluators/EvaluatorDatasetTestPanel";
import type {
  EvaluatorFormLayoutProps,
  EvaluatorFormSection,
} from "@phoenix/components/evaluators/EvaluatorFormLayout";
import { EvaluatorInputMapping } from "@phoenix/components/evaluators/EvaluatorInputMapping";
import { useEvaluatorInputVariables } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/useEvaluatorInputVariables";

type DatasetEvaluatorKind = "prompt" | "code" | "decision" | "builtin";

/** How each kind of evaluator reads the example when a field is unmapped. */
const MAPPING_DESCRIPTIONS: Record<
  Exclude<DatasetEvaluatorKind, "builtin">,
  string
> = {
  prompt:
    "Map evaluator variables to fields on the example. Variables left blank are matched to fields of the same name.",
  code: "Map evaluator arguments to dataset fields. Arguments are auto-detected from your code.",
  decision:
    "Inputs named input, output, reference, or metadata fill from the example when left blank.",
};

/**
 * A dataset evaluator form, as {@link EvaluatorFormLayout} lays it out: the
 * evaluator's sections; the mapping from its variables to example fields
 * docked under them; and a test against a dataset example on the right.
 * Built-in evaluators map their inputs in their own configuration, so they
 * have no mapping panel.
 */
export function makeDatasetEvaluatorFormLayout({
  evaluatorKind,
  identity,
  sections,
  testSection,
}: {
  /** Which kind of evaluator, which names the stored panel sizes too. */
  evaluatorKind: DatasetEvaluatorKind;
  /** The name and description. */
  identity: ReactNode;
  sections: EvaluatorFormSection[];
  /** The test button and its results; see {@link EvaluatorDatasetTestPanel}. */
  testSection?: ReactNode;
}): EvaluatorFormLayoutProps {
  return {
    layoutId: `dataset-${evaluatorKind}`,
    identity,
    sections,
    inputs:
      evaluatorKind === "builtin"
        ? undefined
        : {
            title: evaluatorKind === "prompt" ? "Variables" : "Inputs",
            badge: <DatasetEvaluatorInputsBadge />,
            content: (
              <>
                <Text size="S" color="text-500">
                  {MAPPING_DESCRIPTIONS[evaluatorKind]}
                </Text>
                <EvaluatorInputMapping />
              </>
            ),
          },
    tryIt: <EvaluatorDatasetTestPanel testSection={testSection} />,
  };
}

/** How many variables there are to map. */
const DatasetEvaluatorInputsBadge = () => {
  const variables = useEvaluatorInputVariables();
  return variables.length > 0 ? (
    <Counter variant="quiet" count={variables.length} />
  ) : null;
};
