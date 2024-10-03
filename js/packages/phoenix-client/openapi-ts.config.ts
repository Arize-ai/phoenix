import { defineConfig } from "@hey-api/openapi-ts";

export default defineConfig({
  client: "@hey-api/client-fetch",
  input: "../../../schemas/openapi.json",
  output: "./src/client",
  services: {
    export: false,
  },
  types: {
    export: false,
  },
  schemas: {
    export: false,
  },
});
