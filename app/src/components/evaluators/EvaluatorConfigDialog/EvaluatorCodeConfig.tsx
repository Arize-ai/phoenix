import { graphql, useFragment } from "react-relay";

import { Input, Label, TextField } from "@phoenix/components";
import type { EvaluatorCodeConfig_CodeEvaluatorForm$key } from "@phoenix/components/evaluators/EvaluatorConfigDialog/__generated__/EvaluatorCodeConfig_CodeEvaluatorForm.graphql";
import type { EvaluatorCodeConfig_evaluator$key } from "@phoenix/components/evaluators/EvaluatorConfigDialog/__generated__/EvaluatorCodeConfig_evaluator.graphql";
import { ContainsEvaluatorForm } from "@phoenix/components/evaluators/EvaluatorConfigDialog/BuiltInEvaluatorForm/ContainsEvaluatorForm";
import type { EvaluatorInput } from "@phoenix/components/evaluators/utils";

type EvaluatorCodeConfigProps = {
  queryRef: EvaluatorCodeConfig_evaluator$key;
  evaluatorInput: EvaluatorInput | null;
};

export const EvaluatorCodeConfig = ({
  queryRef,
  evaluatorInput,
}: EvaluatorCodeConfigProps) => {
  const evaluator = useFragment(
    graphql`
      fragment EvaluatorCodeConfig_evaluator on Node {
        id
        ... on Evaluator {
          name
          kind
          isBuiltin
        }
        ... on CodeEvaluator {
          inputSchema
        }
        ... on BuiltInEvaluator {
          inputSchema
        }
        ...EvaluatorCodeConfig_CodeEvaluatorForm
      }
    `,
    queryRef
  );
  return (
    <>
      <TextField>
        <Label>Function</Label>
        <Input
          placeholder="e.g. is_correct"
          disabled={evaluator.isBuiltin}
          value={
            evaluator.isBuiltin && evaluator.name
              ? evaluator.name.toLowerCase()
              : undefined
          }
        />
      </TextField>
      <CodeEvaluatorForm queryRef={evaluator} evaluatorInput={evaluatorInput} />
    </>
  );
};

function CodeEvaluatorForm({
  queryRef,
  evaluatorInput,
}: {
  queryRef: EvaluatorCodeConfig_CodeEvaluatorForm$key;
  evaluatorInput: EvaluatorInput | null;
}) {
  const evaluator = useFragment(
    graphql`
      fragment EvaluatorCodeConfig_CodeEvaluatorForm on Node {
        ... on Evaluator {
          name
          isBuiltin
        }
        ...ContainsEvaluatorForm_query
      }
    `,
    queryRef
  );
  // Built in evaluators have hand made forms
  if (evaluator.isBuiltin) {
    switch (evaluator.name?.toLowerCase()) {
      case "contains": {
        return (
          <ContainsEvaluatorForm
            queryRef={evaluator}
            evaluatorInput={evaluatorInput}
          />
        );
      }
    }
  }
  return <div>CodeEvaluatorForm: {JSON.stringify(evaluator, null, 2)}</div>;
}
