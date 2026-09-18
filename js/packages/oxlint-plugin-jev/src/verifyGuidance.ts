/**
 * Build-time check: every guidance file a check cites must exist in the
 * bundled skills directory. Run after `tsc` so a renamed or removed skill
 * file fails the build, not a user's lint run.
 */
import { existsSync } from "node:fs";

import { CHECKS } from "./checks.js";
import { guidancePath, guidanceSource } from "./guidance.js";

const missing: string[] = [];
for (const check of CHECKS) {
  for (const ref of check.guidance) {
    if (!existsSync(guidancePath(ref)))
      missing.push(`${check.id}: ${guidanceSource(ref)}`);
  }
}
if (missing.length > 0) {
  process.stderr.write(
    `oxlint-plugin-jev: cited guidance files are missing:\n  ${missing.join("\n  ")}\n`
  );
  process.exit(1);
}
process.stdout.write(
  `verify-guidance: ${CHECKS.length} checks, all cited files present\n`
);
