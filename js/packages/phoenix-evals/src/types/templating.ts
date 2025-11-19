import type { ModelMessage } from "ai";

export type PromptTemplate = string | Array<ModelMessage>;
export type RenderedPrompt = string | Array<ModelMessage>;
export type TemplateVariables = Record<string, unknown>;

export interface WithPromptTemplate {
  readonly promptTemplate: PromptTemplate;
  /**
   * List out the prompt template variables needed to perform evaluation
   */
  readonly promptTemplateVariables: string[];
}
