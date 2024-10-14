/**
 * Enum for the different template languages supported by the template editor
 *
 * - FString: `variables look like {variable}`
 * - Mustache: `variables look like {{variable}}`
 *
 * @example
 * ```tsx
 * <TemplateEditor language={TemplateLanguages.Mustache} />
 * ```
 */
export const TemplateLanguages = {
  FString: "f-string", // {variable}
  Mustache: "mustache", // {{variable}}
} as const;
