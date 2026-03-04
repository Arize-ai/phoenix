import { createContext } from "react";

export type EvaluatorParam = {
  name: string;
  type?: "string" | "integer" | "number" | "boolean" | "array" | "object";
};

export const EvaluatorInputVariablesContext = createContext<
  EvaluatorParam[] | null
>(null);
