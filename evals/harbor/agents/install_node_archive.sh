#!/bin/sh
# Extract an archive of node_modules and link the named bins onto PATH.
#
# Usage: install_node_archive.sh <archive> <install-dir> <bin>...
set -eu
ARCHIVE="$1"
INSTALL_DIR="$2"
shift 2
BIN_DIR=/usr/local/bin

mkdir -p "$INSTALL_DIR" "$BIN_DIR"
tar -xzf "$ARCHIVE" -C "$INSTALL_DIR"
for bin in "$@"; do
  ln -sf "$INSTALL_DIR/node_modules/.bin/$bin" "$BIN_DIR/$bin"
done
