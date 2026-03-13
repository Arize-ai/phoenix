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

export type TypeScriptPackageManager = "npm" | "pnpm" | "bun";
export type PythonPackageManager = "pip" | "uv";
export type PackageManager = TypeScriptPackageManager | PythonPackageManager;

const packageManagers: PackageManager[] = ["npm", "pnpm", "bun", "pip", "uv"];

/**
 * TypeGuard for the package manager
 */
export function isPackageManager(value: unknown): value is PackageManager {
  return (
    typeof value === "string" &&
    packageManagers.includes(value as PackageManager)
  );
}
