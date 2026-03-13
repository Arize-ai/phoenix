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

export type PackageManager = "npm" | "pnpm" | "bun" | "pip" | "uv";

/**
 * Available package managers for each programming language.
 */
export const packageManagersByLanguage: Record<
  ProgrammingLanguage,
  PackageManager[]
> = {
  Python: ["pip", "uv"],
  TypeScript: ["npm", "pnpm", "bun"],
};

/**
 * TypeGuard for the package manager
 */
export function isPackageManager(value: unknown): value is PackageManager {
  return (
    typeof value === "string" &&
    Object.values(packageManagersByLanguage).some((managers) =>
      managers.includes(value as PackageManager)
    )
  );
}

/**
 * Per-language package manager preferences.
 */
export type PackageManagerByLanguage = Record<
  ProgrammingLanguage,
  PackageManager
>;

/**
 * The default package manager preference for each language.
 */
export const defaultPackageManagerByLanguage: PackageManagerByLanguage = {
  Python: "pip",
  TypeScript: "npm",
};
