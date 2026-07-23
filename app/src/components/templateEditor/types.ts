import { TemplateFormats } from "./constants";

export type TemplateFormat =
  (typeof TemplateFormats)[keyof typeof TemplateFormats];

/**
 * Type guard for the TemplateFormat type
 */
export function isTemplateFormat(v: string): v is TemplateFormat {
  return (Object.values(TemplateFormats) as readonly string[]).includes(v);
}
