# Development Guide for @arizeai/phoenix-client

## Code Generation

The Phoenix client uses code generation to keep its TypeScript types and API interfaces in sync with the backend OpenAPI schema.

- The OpenAPI schema (`openapi.json`) is located in the `schemas/` directory at the root of the repository.
- The client uses [`openapi-typescript`](https://github.com/drwpow/openapi-typescript) to generate TypeScript types and API interfaces from this schema.
- The generated code is output to `src/__generated__/api/v1.ts` in the `phoenix-client` package.

### How to Regenerate the Client

If the OpenAPI schema changes (for example, after updating the backend or pulling new changes):

1. Make sure you have the latest `openapi.json` in the `schemas/` directory.
2. Run the codegen script from the `phoenix-client` directory:

   ```sh
   pnpm run generate
   ```

3. Commit the updated generated file if there are changes.

**Note:** Always regenerate and commit the generated code when the OpenAPI schema changes to ensure the client stays up to date.
