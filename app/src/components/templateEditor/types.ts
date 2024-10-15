import { TemplateLanguages } from "./constants";

export type TemplateLanguage =
  (typeof TemplateLanguages)[keyof typeof TemplateLanguages];
