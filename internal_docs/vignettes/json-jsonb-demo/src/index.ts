/**
 * Main entry point for the JSON vs JSONB demonstration
 */
import { USE_PGLITE } from "./config/db-config.js";

console.log("PostgreSQL JSON vs JSONB Demo");
console.log("=============================");
console.log(
  "This demonstration showcases the differences between PostgreSQL's JSON and JSONB data types."
);
console.log(
  `Using database backend: ${USE_PGLITE ? "PGlite (in-memory)" : "PostgreSQL"}`
);
console.log("\nTo run specific demos:");
console.log("- pnpm run compare      (Key order comparison)");
console.log("- pnpm run performance  (Performance benchmarks)");
console.log("- pnpm run query        (Query capabilities examples)");
console.log("\nRunning main key order comparison demo...\n");

// Import and run the key comparison demo
import("./compare.js").catch((err) => {
  console.error("Error running comparison demo:", err);
});
