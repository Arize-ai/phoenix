#!/bin/sh
set -eu
ARCHIVE="$1"
INSTALL_DIR="${2:-/opt/phoenix-cli}"
BIN_DIR="${3:-/usr/local/bin}"

mkdir -p "$INSTALL_DIR" "$BIN_DIR"
tar -xzf "$ARCHIVE" -C "$INSTALL_DIR"
for bin in phoenix-cli px pxi; do
  ln -sf "$INSTALL_DIR/node_modules/.bin/$bin" "$BIN_DIR/$bin"
done
