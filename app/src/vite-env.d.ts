/// <reference types="vite/client" />

/**
 * TS 6.0 (TS2882) now validates side-effect imports. "vite/modulepreload-polyfill"
 * is a virtual Vite module with no type declarations on disk, so TypeScript rejects
 * the `import "vite/modulepreload-polyfill"` in index.tsx without this ambient
 * module declaration.
 */
declare module "vite/modulepreload-polyfill" {}
