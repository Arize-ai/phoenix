import { type PropsWithChildren, useMemo } from "react";

import { EvaluatorsInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/EvaluatorsInputVariablesProvider";
import { jsonSchemaZodSchema } from "@phoenix/schemas";

export const CodeEvaluatorInputVariablesProvider = ({
  children,
  evaluatorInputSchema,
}: PropsWithChildren<{ evaluatorInputSchema: unknown }>) => {
  const variables = useMemo(() => {
    if (!evaluatorInputSchema) {
      return [];
    }
    const inputSchema = jsonSchemaZodSchema.safeParse(evaluatorInputSchema);
    if (!inputSchema.success) {
      return [];
    }
    if (!inputSchema.data.properties) {
      return [];
    }
    const inputVariables = Object.keys(inputSchema.data.properties);

    return inputVariables;
  }, [evaluatorInputSchema]);
  return (
    <EvaluatorsInputVariablesProvider variables={variables}>
      {children}
    </EvaluatorsInputVariablesProvider>
  );
};
