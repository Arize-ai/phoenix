/**
 * CLI entry point for the Z3 proof harness. See `prove-lib.ts` for the
 * obligation catalog and `machine.ts` for the proof subject.
 *
 * Run with: `pnpm verify:details-panel` (or `pnpm tsx .../verify/prove.ts`).
 */

import { STATE_INVARIANTS } from "../invariants";
import { RULES } from "../machine";
import { runProofs } from "./prove-lib";

const { obligationCount, failures } = runProofs(RULES);

if (failures.length > 0) {
  // eslint-disable-next-line no-console
  console.error(`✗ ${failures.length} proof obligation(s) failed:`);
  for (const failure of failures) {
    // eslint-disable-next-line no-console
    console.error(`  ${failure}`);
  }
  process.exit(1);
}

// eslint-disable-next-line no-console
console.info(
  `✓ z3 proved all ${obligationCount} obligations (${STATE_INVARIANTS.length} invariants × {init, ${RULES.length} rules} + commit/effect/idempotence/Lipschitz theorems) for all integer widths, viewports, and parameters.`
);
