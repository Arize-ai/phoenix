#!/usr/bin/env node
/* eslint-disable no-undef */
import { execSync } from "child_process";
import esbuild from "esbuild";

import { relay } from "./esbuild.relay.mjs";

let mode = "build";
if (process.argv.length > 2 && process.argv[2] === "dev") {
  mode = "dev";
}
const isDev = mode === "dev";

let indexFileName = "index.js";
if (mode !== "dev") {
  const commitHash = execSync("git rev-parse HEAD").toString().trim().substring(0, 8);
  indexFileName = `index.${commitHash}.js`;
}

const buildOptions = {
  entryPoints: ["src/index.tsx"],
  outfile: `../src/phoenix/server/static/${indexFileName}`,
  minify: !isDev,
  bundle: true,
  target: ["es2020"],
  jsx: "automatic",
  format: "esm",
  plugins: [relay],
  logLevel: "debug",
  sourcemap: isDev ? "linked" : false,
};

if (isDev) {
  const ctx = await esbuild.context(buildOptions);
  await ctx.watch();
} else {
  // Simply build the artifacts.
  esbuild.build(buildOptions);
}
