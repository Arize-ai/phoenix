/**
 * Converts whitespace to dashes and removes characters that are not accepted
 * by Phoenix's URI-safe project-name fields. Letter case and valid separators
 * are preserved.
 */
export function transformURISafeInput(value: string): string {
  return value.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9._-]/g, "");
}
