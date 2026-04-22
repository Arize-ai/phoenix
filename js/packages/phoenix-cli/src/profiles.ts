/**
 * Profile storage schema definitions for the Phoenix CLI.
 *
 * This module exports the Zod schemas and inferred TypeScript types that
 * describe the on-disk `profiles.json` format. Runtime I/O, parsing, and
 * profile resolution logic live alongside the CLI commands that consume
 * them; this file is the canonical source for
 * `schemas/profile.schema.json` (emitted by `scripts/build-schema.ts`).
 */

import { z } from "zod";

const PERMISSION_SCOPE_DESCRIPTION = `A permission scope string. Grammar:
- Exact: "<resource>.<verb>" (e.g. "projects.delete")
- Resource wildcard: "<resource>.*" (all verbs on a resource)
- Verb wildcard: "*.<verb>" (a verb across all resources)
- Universal: "*" (all operations)

Canonical form is two segments separated by ".": <resource>.<verb>.

v1 posture: only delete verbs are enforced today. Read and write operations are always allowed regardless of this list. See OPERATION_MAP in permissions.ts for the list of currently-enforced resource.verb pairs.

Unknown scope strings are silently ignored at runtime rather than rejected, so forward-compatibility with future scopes does not require a schema version bump. Typos therefore do not surface as errors — double-check entries against the operation map.

Enforcement spec: work item "cli-per-resource-permissions-wire-enforcement".`;

export const ProfileEntrySchema = z.object({
  endpoint: z
    .string()
    .optional()
    .describe(
      "Phoenix server URL this profile targets (e.g. https://app.phoenix.arize.com or http://localhost:6006)."
    ),
  apiKey: z
    .string()
    .optional()
    .describe(
      "API key sent as `Authorization: Bearer <apiKey>` with every request. Accepts both user and system API keys for self-hosted Phoenix and Phoenix Cloud. Treat as a secret — the profiles file should be user-readable only (mode 0600)."
    ),
  project: z
    .string()
    .optional()
    .describe(
      "Default Phoenix project name used when commands don't pass --project."
    ),
  headers: z
    .record(z.string(), z.string())
    .optional()
    .describe(
      "Extra HTTP headers sent with every request from this profile. Useful for custom auth or routing. Values override defaults."
    ),
  permissions: z
    .array(z.string().describe(PERMISSION_SCOPE_DESCRIPTION))
    .optional()
    .describe(
      "Permissions granted to this profile. When omitted, the file-level defaultPermissions apply. When present, this list fully replaces the default set for this profile."
    ),
});

export const ProfilesFileSchema = z.object({
  $schema: z
    .string()
    .optional()
    .describe(
      "Optional JSON Schema URL for editor autocomplete. Pin to a GitHub raw URL at a released tag; see README."
    ),
  version: z
    .literal(1)
    .describe("Schema version. Bumped on breaking changes to the file format."),
  activeProfile: z
    .union([z.string(), z.null()])
    .describe(
      "Name of the profile to use when no --profile flag is passed. Must match a key in `profiles`."
    ),
  defaultPermissions: z
    .array(z.string().describe(PERMISSION_SCOPE_DESCRIPTION))
    .optional()
    .describe(
      "Fallback permission set applied to profiles that do not declare their own `permissions`. Profile-level permissions fully replace this list rather than extending it."
    ),
  profiles: z
    .record(z.string(), ProfileEntrySchema)
    .describe(
      "Map of profile name to profile entry. Keys are the profile names referenced by `activeProfile` and the --profile flag."
    ),
});

/**
 * A single named profile entry. All fields are optional — a profile may
 * override only a subset of configuration values.
 */
export type ProfileEntry = z.infer<typeof ProfileEntrySchema>;

/**
 * On-disk schema for the profiles config file.
 */
export type ProfilesFile = z.infer<typeof ProfilesFileSchema>;
