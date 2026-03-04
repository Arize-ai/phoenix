import { type PropsWithChildren, useMemo } from "react";

import type { EvaluatorParam } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/evaluatorInputVariablesContext";
import { EvaluatorInputVariablesProvider } from "@phoenix/components/evaluators/EvaluatorInputVariablesContext/EvaluatorInputVariablesProvider";
import { jsonSchemaZodSchema } from "@phoenix/schemas";

const SUPPORTED_TYPES = new Set([
  "string",
  "integer",
  "number",
  "boolean",
  "array",
  "object",
]);

export const CodeEvaluatorInputVariablesProvider = ({
  children,
  evaluatorInputSchema,
}: PropsWithChildren<{ evaluatorInputSchema: unknown }>) => {
  const variables: EvaluatorParam[] = useMemo(() => {
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
    const properties = inputSchema.data.properties;
    return Object.keys(properties).map((name) => {
      const prop = properties[name];
      const rawType = prop && "type" in prop ? prop.type : undefined;
      const type =
        rawType && SUPPORTED_TYPES.has(rawType)
          ? (rawType as EvaluatorParam["type"])
          : undefined;
      return { name, type };
    });
  }, [evaluatorInputSchema]);
  return (
    <EvaluatorInputVariablesProvider variables={variables}>
      {children}
    </EvaluatorInputVariablesProvider>
  );
};
