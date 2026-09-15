#!/bin/sh
# Install @arizeai/phoenix-cli from source tarballs instead of the npm registry.
#
# Usage: install_phoenix_cli.sh <tarball-dir> [install-dir] [bin-dir]
#
# The tarball directory holds `pnpm pack` output for the CLI and every workspace
# package it depends on. Each tarball becomes an npm override, so the workspace
# packages resolve to the local builds while third-party dependencies still come
# from the registry. The bins are then linked into a directory on PATH.
set -eu
TARBALL_DIR=$(cd "$1" && pwd)
INSTALL_DIR="${2:-/opt/phoenix-cli}"
BIN_DIR="${3:-/usr/local/bin}"

mkdir -p "$INSTALL_DIR" "$BIN_DIR"
node - "$TARBALL_DIR" "$INSTALL_DIR" <<'JS'
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const [tarballDir, installDir] = process.argv.slice(2);
const overrides = {};
for (const file of fs.readdirSync(tarballDir).filter((f) => f.endsWith(".tgz"))) {
  const tarball = path.join(tarballDir, file);
  const manifest = execFileSync("tar", ["-xOf", tarball, "package/package.json"]);
  overrides[JSON.parse(manifest).name] = `file:${tarball}`;
}
const cli = overrides["@arizeai/phoenix-cli"];
if (!cli) throw new Error(`no @arizeai/phoenix-cli tarball in ${tarballDir}`);
const manifest = { name: "phoenix-cli-install", private: true, dependencies: { "@arizeai/phoenix-cli": cli }, overrides };
fs.writeFileSync(path.join(installDir, "package.json"), JSON.stringify(manifest, null, 2));
JS
cd "$INSTALL_DIR"
npm install --omit=dev --no-audit --no-fund --loglevel=error
for bin in phoenix-cli px pxi; do
  ln -sf "$INSTALL_DIR/node_modules/.bin/$bin" "$BIN_DIR/$bin"
done
