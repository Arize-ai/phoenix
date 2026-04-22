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
  endpoint: z.string().optional(),
  project: z.string().optional(),
  headers: z.record(z.string(), z.string()).optional(),
  permissions: z.array(z.string()).optional(),
});

export const ProfilesFileSchema = z.object({
  $schema: z.string().optional(),
  version: z.literal(1),
  activeProfile: z.union([z.string(), z.null()]),
  defaultPermissions: z.array(z.string()).optional(),
  profiles: z.record(z.string(), ProfileEntrySchema),
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
