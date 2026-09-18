/**
 * Content-addressed on-disk cache for jev responses.
 *
 * The cache key is a hash of the entire request (model, state = code +
 * guidance text, questions), so any change to the file, the checks, or the
 * shipped skill text invalidates the entry. Re-linting an unchanged file is
 * free, which is what makes running this in a pre-commit or CI loop viable.
 */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { SystemOneRequest, SystemOneResponse } from "./jev/types.js";

export function resolveCacheDir(cwd: string): string {
  const explicit = process.env.OXLINT_JEV_CACHE_DIR;
  if (explicit) return path.resolve(cwd, explicit);
  // Walk up to the nearest node_modules so monorepo packages share a cache.
  let dir = cwd;
  for (;;) {
    const candidate = path.join(dir, "node_modules");
    if (existsSync(candidate))
      return path.join(candidate, ".cache", "oxlint-jev");
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return path.join(os.tmpdir(), "oxlint-jev");
}

export function requestHash(request: SystemOneRequest): string {
  return createHash("sha256")
    .update(JSON.stringify(request))
    .digest("hex")
    .slice(0, 32);
}

export class ResponseCache {
  constructor(private readonly dir: string) {}

  private file(hash: string): string {
    return path.join(this.dir, "responses", `${hash}.json`);
  }

  get(hash: string): SystemOneResponse | undefined {
    const file = this.file(hash);
    if (!existsSync(file)) return undefined;
    try {
      return JSON.parse(readFileSync(file, "utf8")) as SystemOneResponse;
    } catch {
      return undefined;
    }
  }

  set(hash: string, response: SystemOneResponse): void {
    const file = this.file(hash);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify(response, null, 2));
  }

  /** Record mode: persist the outgoing request so its shape can be inspected. */
  record(hash: string, filename: string, request: SystemOneRequest): string {
    const file = path.join(this.dir, "requests", `${hash}.json`);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, JSON.stringify({ filename, request }, null, 2));
    return file;
  }
}
