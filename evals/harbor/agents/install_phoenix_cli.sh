#!/bin/sh
set -eu
ARCHIVE="$1"
INSTALL_DIR="${2:-/opt/phoenix-cli}"
BIN_DIR="${3:-/usr/local/bin}"

mkdir -p "$INSTALL_DIR" "$BIN_DIR"
tar -xzf "$ARCHIVE" -C "$INSTALL_DIR"
# px only: pxi is the PXI agent itself, which is a separate condition, not a tool the
# CLI agents get to delegate to.
for bin in phoenix-cli px; do
  ln -sf "$INSTALL_DIR/node_modules/.bin/$bin" "$BIN_DIR/$bin"
done
