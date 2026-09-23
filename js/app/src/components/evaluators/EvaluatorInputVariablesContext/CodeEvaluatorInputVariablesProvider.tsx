import { type PropsWithChildren, useMemo } from "react";

import { EvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/EvaluatorInputVariablesProvider";
import { jsonSchemaZodSchema } from "@phoenix/schemas";

export const CodeEvaluatorInputVariablesProvider = ({
  children,
  evaluatorInputSchema,
  variables: initialVariables,
}: PropsWithChildren<{
  evaluatorInputSchema?: unknown;
  variables?: string[];
}>) => {
  const variables = useMemo(() => {
    if (initialVariables != null) {
      return initialVariables;
    }
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
  }, [evaluatorInputSchema, initialVariables]);
  return (
    <EvaluatorInputVariablesProvider variables={variables}>
      {children}
    </EvaluatorInputVariablesProvider>
  );
};
