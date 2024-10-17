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
  FString: "F_STRING", // {variable}
  Mustache: "MUSTACHE", // {{variable}}
} as const;
