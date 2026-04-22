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

export const ProfileEntrySchema = z.object({
  endpoint: z
    .string()
    .optional()
    .describe(
      "Phoenix server URL this profile targets (e.g. https://app.phoenix.arize.com or http://localhost:6006)."
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
    .array(z.string())
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
    .array(z.string())
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
