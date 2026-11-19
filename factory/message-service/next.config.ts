import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: repositoryRoot,
  turbopack: { root: repositoryRoot },
};

export default nextConfig;
