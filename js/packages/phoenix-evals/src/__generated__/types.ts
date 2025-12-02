// This file is generated. Do not edit by hand.

import type { PromptTemplate } from "../types/templating";

export type ClassificationEvaluatorConfig = {
  name: string;
  description: string;
  optimizationDirection: "MINIMIZE" | "MAXIMIZE";
  template: PromptTemplate;
  choices: Record<string, number>;
};
