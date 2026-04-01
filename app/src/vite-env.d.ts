/// <reference types="vite/client" />

/**
 * TS 6.0 (TS2882) now validates side-effect imports. "vite/modulepreload-polyfill"
 * is a virtual Vite module with no type declarations on disk, so TypeScript rejects
 * the `import "vite/modulepreload-polyfill"` in index.tsx without this ambient
 * module declaration.
 */
declare module "vite/modulepreload-polyfill" {}

/**
 * Apollo Client does not publicly export readMultipartBody from its package.json
 * exports map, but the .js and .d.ts files exist on disk and Vite resolves them
 * at bundle time. This ambient declaration lets TypeScript see the type.
 */
declare module "@apollo/client/link/http/parseAndCheckHttpResponse" {
  export function readMultipartBody<T extends object = Record<string, unknown>>(
    response: Response,
    nextValue: (value: T) => void
  ): Promise<void>;
}
