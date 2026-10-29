#!/usr/bin/env bash
# Prepares a factory sandbox: the Node version in .nvmrc, `make setup`, a running
# PostgreSQL for the server and a pg_ctl for the PostgreSQL test fixtures. It ends with
# a report of what works and how to start the server for an end-to-end probe. Anything
# it reports missing is a verification gap for the PR body; CI runs the full matrix.
set -uo pipefail
cd "$(dirname "$0")/.."
repo_dir=$(pwd)

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

# PostgreSQL refuses to run as root, and the sandbox runs as root, so PostgreSQL and the
# pytest fixtures that start their own PostgreSQL run as the `factory` user.
pg_user=factory
pg_dir=/tmp/factory-pg
pg_port=15432
pg_url="postgresql://phoenix@127.0.0.1:$pg_port/phoenix"
pg_status="unavailable (no pg_ctl)"
run_as_pg_user() {
  if [ "$(id -u)" -eq 0 ]; then
    su "$pg_user" -s /bin/bash -c "$1"
  else
    bash -c "$1"
  fi
}
if [ -n "$pg_ctl_path" ]; then
  pg_bin=$(dirname "$pg_ctl_path")
  if [ "$(id -u)" -eq 0 ]; then
    id -u "$pg_user" >/dev/null 2>&1 || useradd -m "$pg_user"
    # The fixtures import the repo's venv as that user, and pytest writes its cache.
    chmod -R a+rX "$repo_dir/.venv" 2>/dev/null
    mkdir -p "$pg_dir" && chown "$pg_user" "$pg_dir"
  else
    pg_user=$(id -un)
    mkdir -p "$pg_dir"
  fi
  if [ ! -s "$pg_dir/data/PG_VERSION" ]; then
    run_as_pg_user "$pg_bin/initdb -D $pg_dir/data -U phoenix --auth=trust" >"$pg_dir/initdb.log" 2>&1
  fi
  if ! run_as_pg_user "$pg_bin/pg_ctl -D $pg_dir/data status" >/dev/null 2>&1; then
    run_as_pg_user "$pg_bin/pg_ctl -D $pg_dir/data -l $pg_dir/server.log -o '-p $pg_port -k $pg_dir' -w start" >/dev/null 2>&1
  fi
  if run_as_pg_user "$pg_bin/pg_isready -h 127.0.0.1 -p $pg_port" >/dev/null 2>&1; then
    run_as_pg_user "$pg_bin/createdb -h 127.0.0.1 -p $pg_port -U phoenix phoenix" >/dev/null 2>&1
    pg_status=ok
  else
    pg_status="failed to start; see $pg_dir/server.log and $pg_dir/initdb.log"
  fi
fi

echo "--- factory bootstrap report"
echo "node: $(node --version 2>/dev/null || echo missing) (want v$node_version)"
echo "pnpm: $(pnpm --version 2>/dev/null || echo missing)"
echo "uv: $(uv --version 2>/dev/null || echo missing)"
echo "gh: $(gh --version 2>/dev/null | head -n 1 | grep . || echo missing)"
echo "px: $(px --version 2>/dev/null || echo missing)"
echo "agent-browser: $(agent-browser --version 2>/dev/null || echo missing)"
if [ "$setup_status" -eq 0 ]; then
  echo "make setup: ok"
else
  echo "make setup: failed (exit $setup_status); last lines of /tmp/factory-setup.log:"
  tail -n 20 /tmp/factory-setup.log
fi
if [ "$pg_status" = ok ]; then
  echo "postgresql: running at $pg_url (data $pg_dir/data, log $pg_dir/server.log)"
  echo "pytest on PostgreSQL: run as $pg_user, since the fixtures start their own PostgreSQL:"
  echo "  su $pg_user -s /bin/bash -c 'cd $repo_dir && PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m pytest -o cache_dir=/tmp/factory-pytest-cache --db all --postgresql-exec $pg_ctl_path <tests>'"
else
  echo "postgresql: $pg_status; rely on CI for --db postgresql"
fi
echo "server for an end-to-end probe (stop it with kill when the probe is done):"
echo "  SQLite:     PHOENIX_WORKING_DIR=/tmp/factory-phoenix PHOENIX_PORT=6006 PHOENIX_GRPC_PORT=4317 uv run --no-sync phoenix serve &"
if [ "$pg_status" = ok ]; then
  echo "  PostgreSQL: PHOENIX_SQL_DATABASE_URL=$pg_url PHOENIX_PORT=6006 PHOENIX_GRPC_PORT=4317 uv run --no-sync phoenix serve &"
fi
echo "  wait for: curl -sf http://127.0.0.1:6006/healthz; OTLP at http://127.0.0.1:6006/v1/traces and grpc 127.0.0.1:4317; UI for agent-browser at http://127.0.0.1:6006"
echo "  the UI needs a built frontend: run 'pnpm -C js/app run build:deps && pnpm -C js/app build' once before a browser probe, and again after frontend changes"
