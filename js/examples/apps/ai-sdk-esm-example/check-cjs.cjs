/**
 * Validates the CommonJS entry point of the installed package. require() must
 * resolve the CJS build (dist/src) and expose the public API — this is the
 * path that breaks if a dependency upgrade drags in an ESM-only module.
 */

const assert = require("node:assert");

const resolved = require.resolve("@arizeai/phoenix-otel");
assert.match(
  resolved,
  /dist[\\/]src[\\/]index\.js$/,
  `require() resolved "${resolved}" instead of the CJS build`
);

const { register } = require("@arizeai/phoenix-otel");
assert.strictEqual(
  typeof register,
  "function",
  "register is not exported from the CJS entry point"
);

console.log(`✅ CJS require() resolved ${resolved}`);
console.log("✅ register is callable from CommonJS");
