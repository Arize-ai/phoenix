// Importing instrumentation registers the Phoenix OpenTelemetry provider, so
// agent spans produced during an eval are exported and linked to their
// experiment run. dotenv runs first (see vitest.config.ts setupFiles order),
// so PHOENIX_COLLECTOR_ENDPOINT / PHOENIX_API_KEY are set before register().
import { afterAll } from "vitest";

import { flush } from "../src/instrumentation.js";

// Worker threads don't reliably fire `beforeExit`, so flush pending spans
// explicitly once every suite in this file has finished.
afterAll(async () => {
  await flush();
});
