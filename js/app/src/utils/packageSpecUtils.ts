/**
 * Validators for the package specifiers users type into "one package per
 * line" textareas (e.g. the sandbox dependencies editor). Grammar mirrors
 * the server-side pydantic validators in
 * `src/phoenix/server/sandbox/types.py` — keep the two in sync.
 *
 * npm and Python requirements are validated independently. No
 * cross-conversion: a Python-style spec is invalid as npm, and vice
 * versa.
 */

/** The package ecosystems this module knows how to validate. */
export type PackageEcosystem = "PYTHON" | "TYPESCRIPT";

/** One identifier segment: starts/ends alphanumeric, allows `.`/`_`/`-`/`~` inside. */
const IDENT = `[A-Za-z0-9](?:[A-Za-z0-9._~-]*[A-Za-z0-9])?`;

/** An npm requirement: `name` or `name@version` (incl. `@scope/name`). */
const NPM_REQUIREMENT_RE = new RegExp(
  `^(?:@${IDENT}/)?${IDENT}(?:@[^@\\s]+)?$`
);

/** PEP 508 extras list, e.g. `[socks,brotli]`. */
const PY_EXTRAS = `(?:\\[\\s*[A-Za-z0-9._-]+(?:\\s*,\\s*[A-Za-z0-9._-]+)*\\s*\\])?`;

/** One PEP 440 version clause, e.g. `>=1.2`, `==1.*`, `~=2.0`. */
const PY_VERSION_CLAUSE = `(?:===|==|!=|~=|<=|>=|<|>)\\s*[A-Za-z0-9*][A-Za-z0-9.*+!_-]*`;

const PYTHON_REQUIREMENT_RE = new RegExp(
  `^${IDENT}\\s*${PY_EXTRAS}\\s*(?:${PY_VERSION_CLAUSE}(?:\\s*,\\s*${PY_VERSION_CLAUSE})*)?\\s*$`
);

/**
 * Splits the user-edited "one package per line" textarea into a normalized
 * list of package specifiers. Lines are trimmed and blank lines dropped.
 */
export function getDependencyPackages(packagesText: string): string[] {
  return packagesText
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

export type DependencyPackagesValidationResult =
  | { valid: true }
  | { valid: false; message: string };

/**
 * Validate a "one package per line" textarea against the grammar for the
 * given package ecosystem. Returns `{ valid: true }` for an empty list, or
 * `{ valid: false, message }` naming the first offending line.
 */
export function validateDependencyPackages({
  packagesText,
  language,
}: {
  packagesText: string;
  language: PackageEcosystem;
}): DependencyPackagesValidationResult {
  const isPython = language === "PYTHON";
  for (const pkg of getDependencyPackages(packagesText)) {
    if (isPython) {
      if (!PYTHON_REQUIREMENT_RE.test(pkg)) {
        return {
          valid: false,
          message: `Invalid Python package spec: "${pkg}" (e.g. "requests", "numpy==1.26.0", "httpx[http2]>=0.27,<1")`,
        };
      }
    } else if (!NPM_REQUIREMENT_RE.test(pkg)) {
      return {
        valid: false,
        message: `Invalid npm package spec: "${pkg}" (e.g. "lodash", "lodash@^4.17", "@scope/pkg@1.2.3")`,
      };
    }
  }
  return { valid: true };
}
