import { TemplateLanguages } from "./constants";

export type TemplateLanguage =
  (typeof TemplateLanguages)[keyof typeof TemplateLanguages];

/**
 * Type guard for the TemplateLanguage type
 */
export function isTemplateLanguage(v: string): v is TemplateLanguage {
  return Object.values(TemplateLanguages).includes(v as TemplateLanguage);
}
