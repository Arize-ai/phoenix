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

export const typescriptPackageManagers = ["npm", "pnpm", "bun"] as const;
export const pythonPackageManagers = ["pip", "uv"] as const;

export type TypeScriptPackageManager =
  (typeof typescriptPackageManagers)[number];
export type PythonPackageManager = (typeof pythonPackageManagers)[number];
export type PackageManager = TypeScriptPackageManager | PythonPackageManager;

const packageManagers = [
  ...typescriptPackageManagers,
  ...pythonPackageManagers,
];

/**
 * TypeGuard for the package manager
 */
export function isPackageManager(value: unknown): value is PackageManager {
  return (
    typeof value === "string" &&
    packageManagers.includes(value as PackageManager)
  );
}
