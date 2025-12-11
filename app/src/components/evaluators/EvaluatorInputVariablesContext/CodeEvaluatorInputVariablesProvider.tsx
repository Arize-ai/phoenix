import { type PropsWithChildren, useMemo } from "react";

import { EvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/EvaluatorInputVariablesProvider";
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
    <EvaluatorInputVariablesProvider variables={variables}>
      {children}
    </EvaluatorInputVariablesProvider>
  );
};
