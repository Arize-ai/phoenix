/**
 * Enum for the different template formats supported by the template editor
 *
 * - FString: `variables look like {variable}`
 * - Mustache: `variables look like {{variable}}`
 *
 * @example
 * ```tsx
 * <TemplateEditor format={TemplateFormats.Mustache} />
 * ```
 */
export const TemplateFormats = {
  NONE: "NONE", // No templating
  FString: "F_STRING", // {variable}
  Mustache: "MUSTACHE", // {{variable}}
} as const;
