#!/usr/bin/env node
/* eslint-disable no-undef */
import { execSync } from "child_process";
import esbuild from "esbuild";
import { writeFile } from "fs";

import { relay } from "./esbuild.relay.mjs";

let mode = "build";
if (process.argv.length > 2 && process.argv[2] === "dev") {
  mode = "dev";
}
const isDev = mode === "dev";
const outdir = "../src/phoenix/server/static"
const buildId = mode === "dev" ? null : execSync("git rev-parse HEAD").toString().trim().substring(0, 8);
const indexFileName = buildId ? `index.${buildId}.js` : "index.js";
const buildOptions = {
  entryPoints: ["src/index.tsx"],
  outfile: `${outdir}/${indexFileName}`,
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
writeFile(`${outdir}/build.json`, JSON.stringify({ buildId }));
