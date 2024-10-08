/** @type {import('ts-jest').JestConfigWithTsJest} */

// eslint-disable-next-line no-undef
module.exports = {
  preset: "ts-jest",
  testEnvironment: "jsdom",
  prettierPath: null,
  setupFiles: ["<rootDir>/jest.setup.ts"],
  testMatch: ["**/__tests__/*.test.ts?(x)"],
  transform: {
    "^.+\\.[jt]sx?$": ["esbuild-jest"],
  },
  // .spec.ts files are for playwright e2e tests, jest unit tests are labeled with .test.ts
  testPathIgnorePatterns: ["\\.spec\\.ts$"],
  transformIgnorePatterns: [".*node_modules/.pnpm/(?!d3)@"],
  moduleNameMapper: {
    "^@phoenix/(.*)$": "<rootDir>/src/$1",
  },
};
