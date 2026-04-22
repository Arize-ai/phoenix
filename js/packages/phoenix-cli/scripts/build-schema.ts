import { execFileSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";
import { toJSONSchema } from "zod/v4/core";

import { OPERATION_MAP } from "../src/permissions.js";
import { ProfilesFileSchema } from "../src/profiles.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outDir = path.join(__dirname, "..", "schemas");
const outFile = path.join(outDir, "profile.schema.json");

const schema = toJSONSchema(ProfilesFileSchema, { target: "draft-7" });

/**
 * Derive the example scope strings exposed on `permissions` / `defaultPermissions`
 * items in the generated JSON Schema. The shape is intentionally taken straight
 * from `OPERATION_MAP` plus the wildcard forms documented in the scope grammar,
 * so editor autocomplete stays in sync with runtime-enforced scopes without a
 * separate hand-maintained list.
 */
function derivePermissionExamples(): string[] {
  const concrete = new Set(OPERATION_MAP.map((op) => op.scope));
  const resources = new Set<string>();
  const verbs = new Set<string>();
  for (const scope of concrete) {
    const [resource, verb] = scope.split(".", 2);
    if (resource && verb) {
      resources.add(resource);
      verbs.add(verb);
    }
  }
  const examples = new Set<string>();
  examples.add("*");
  for (const verb of verbs) {
    examples.add(`*.${verb}`);
  }
  for (const resource of resources) {
    examples.add(`${resource}.*`);
  }
  for (const scope of concrete) {
    examples.add(scope);
  }
  return Array.from(examples);
}

const permissionExamples = derivePermissionExamples();

/**
 * Locate every `permissions` / `defaultPermissions` items node in the emitted
 * schema and attach the examples array. The two known sites are:
 *   - schema.properties.defaultPermissions.items  (file-level)
 *   - schema.properties.profiles.additionalProperties.properties.permissions.items
 *     (per-profile — `z.record(z.string(), ProfileEntrySchema)` emits
 *     `propertyNames` + `additionalProperties`, with the profile shape on the
 *     latter).
 * Mutating here rather than at the Zod layer keeps the schema module free of
 * JSON-Schema-specific concerns; the examples are purely a documentation hint
 * for editor autocomplete, not a validation constraint.
 */
function attachPermissionExamples(root: unknown): void {
  if (!isObject(root)) return;
  const topProps = getObjectProp(root, "properties");
  if (!topProps) return;

  const defaultPermissions = getObjectProp(topProps, "defaultPermissions");
  const defaultItems =
    defaultPermissions && getObjectProp(defaultPermissions, "items");
  if (defaultItems) {
    defaultItems.examples = permissionExamples;
  }

  const profiles = getObjectProp(topProps, "profiles");
  const profileShape =
    profiles && getObjectProp(profiles, "additionalProperties");
  const profileProps =
    profileShape && getObjectProp(profileShape, "properties");
  const permissions =
    profileProps && getObjectProp(profileProps, "permissions");
  const permissionsItems = permissions && getObjectProp(permissions, "items");
  if (permissionsItems) {
    permissionsItems.examples = permissionExamples;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getObjectProp(
  obj: Record<string, unknown>,
  key: string
): Record<string, unknown> | undefined {
  const value = obj[key];
  return isObject(value) ? value : undefined;
}

attachPermissionExamples(schema);

fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outFile, JSON.stringify(schema, null, 2) + "\n");

// Run the repo's JSON formatter on the emitted schema so the committed
// artifact matches `fmt:check`. Without this, `JSON.stringify` produces
// multi-line `required` arrays that oxfmt flags as unformatted.
const repoRoot = path.resolve(__dirname, "..", "..", "..", "..");
execFileSync(
  path.join(repoRoot, "js", "node_modules", ".bin", "oxfmt"),
  ["--config", path.join(repoRoot, ".oxfmtrc.jsonc"), outFile],
  { stdio: "inherit" }
);

console.log(`Written: ${outFile}`);
