export type ProgrammingLanguage = "Python" | "TypeScript";

export const programmingLanguages: ProgrammingLanguage[] = [
  "Python",
  "TypeScript",
];

/**
 * TypeGuard for the programming language
 */
export function isProgrammingLanguage(l: unknown): l is ProgrammingLanguage {
  return (
    typeof l === "string" &&
    programmingLanguages.includes(l as ProgrammingLanguage)
  );
}
