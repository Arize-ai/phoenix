#!/usr/bin/env bash
# Prepares a factory sandbox: the Node version in .nvmrc, `make setup`, and a pg_ctl
# for the PostgreSQL test fixtures. It ends with a report of what works. Anything it
# reports missing is a verification gap for the PR body; CI runs the full matrix.
set -uo pipefail
cd "$(dirname "$0")/.."

node_version=$(tr -d 'v[:space:]' < .nvmrc)
if [ "$(node --version 2>/dev/null)" != "v$node_version" ]; then
  echo "Installing Node $node_version into /usr/local..."
  sudo_command=$([ -w /usr/local/bin ] || echo sudo)
  curl -fsSL "https://nodejs.org/dist/v$node_version/node-v$node_version-linux-x64.tar.xz" \
    | $sudo_command tar -xJ -C /usr/local --strip-components=1
  hash -r
fi

make setup >/tmp/factory-setup.log 2>&1
setup_status=$?

pg_ctl_path=$(ls /usr/lib/postgresql/*/bin/pg_ctl 2>/dev/null | sort -V | tail -n 1)

echo "--- factory bootstrap report"
echo "node: $(node --version 2>/dev/null || echo missing) (want v$node_version)"
echo "pnpm: $(pnpm --version 2>/dev/null || echo missing)"
echo "uv: $(uv --version 2>/dev/null || echo missing)"
if [ "$setup_status" -eq 0 ]; then
  echo "make setup: ok"
else
  echo "make setup: failed (exit $setup_status); last lines of /tmp/factory-setup.log:"
  tail -n 20 /tmp/factory-setup.log
fi
if [ -z "$pg_ctl_path" ]; then
  echo "postgresql: unavailable (no pg_ctl); rely on CI for --db postgresql"
elif [ "$(id -u)" -eq 0 ]; then
  echo "postgresql: unavailable (PostgreSQL refuses to run as root); rely on CI for --db postgresql"
else
  echo "postgresql: pass --db all --postgresql-exec $pg_ctl_path to pytest"
fi
