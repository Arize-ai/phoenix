export type Template = string;
export type TemplateVariables = Record<string, unknown>;

/**
 * A class or object that has a prompt template
 */
export interface WithPromptTemplate {
  readonly promptTemplate: Template;
  get promptTemplateVariables(): string[];
}
