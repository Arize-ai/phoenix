#!/usr/bin/env bash
# Prepares a factory sandbox: the Node version in .nvmrc, `make setup`, a running
# PostgreSQL for the server, a pg_ctl for the PostgreSQL test fixtures, a headless
# browser for acceptance tests that drive the UI, and a gh that can attach screenshots
# to a PR. It ends with a report of what works and how to start the server for an
# acceptance test. Anything it reports missing is a verification gap for the PR body;
# CI runs the full matrix.
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

# agent-browser downloads Chrome for Testing on first launch, and the sandbox's limited
# network blocks that host, so it is pointed at the Chromium that ships with the
# sandbox's Playwright. Chromium refuses to run as root without --no-sandbox.
browsers_dir=${PLAYWRIGHT_BROWSERS_PATH:-/opt/pw-browsers}
chromium_path=$(find "$browsers_dir" -maxdepth 3 -type f -name chrome 2>/dev/null | sort -V | tail -n 1)
browser_launch=""
browser_status="unavailable (agent-browser missing)"
browser_log=/tmp/factory-browser.log
if command -v agent-browser >/dev/null 2>&1; then
  if [ -z "$chromium_path" ]; then
    browser_status="unavailable (no Chromium under $browsers_dir)"
  else
    export AGENT_BROWSER_EXECUTABLE_PATH=$chromium_path
    browser_status="failed to launch; see $browser_log"
    for launch_args in "" "--args --no-sandbox"; do
      agent-browser close >/dev/null 2>&1
      # shellcheck disable=SC2086
      if agent-browser $launch_args open about:blank >"$browser_log" 2>&1 \
        && agent-browser screenshot /tmp/factory-browser-check.png >>"$browser_log" 2>&1; then
        browser_status=ok
        browser_launch="agent-browser ${launch_args:+$launch_args }open"
        break
      fi
    done
    agent-browser close >/dev/null 2>&1
  fi
fi

# `gh pr edit --attach` uploads a screenshot into a PR body. Ubuntu's gh predates it, so
# a release build from GitHub, which allow_package_managers permits, replaces it.
gh_attach_version=2.103.3
# sha256 of gh_2.103.3_linux_amd64.tar.gz from the release's gh_2.103.3_checksums.txt
gh_attach_sha256=4c806978ffce1cec70853302a56d70ac6da4f19bae7adca4e1a8ab00633dd91d
if command -v gh >/dev/null 2>&1 && ! gh pr edit --help 2>/dev/null | grep -q -- '--attach'; then
  gh_tarball="gh_${gh_attach_version}_linux_amd64"
  if curl -fsSL -o "/tmp/$gh_tarball.tar.gz" "https://github.com/cli/cli/releases/download/v$gh_attach_version/$gh_tarball.tar.gz" \
    && echo "$gh_attach_sha256  /tmp/$gh_tarball.tar.gz" | sha256sum -c --status \
    && tar -xzf "/tmp/$gh_tarball.tar.gz" -C /tmp "$gh_tarball/bin/gh" 2>/dev/null; then
    sudo_command=$([ -w "$(dirname "$(command -v gh)")" ] || echo sudo)
    $sudo_command install -m 755 "/tmp/$gh_tarball/bin/gh" "$(command -v gh)"
    hash -r
  fi
fi
gh_attach_status=$(gh pr edit --help 2>/dev/null | grep -q -- '--attach' && echo ok || echo "unavailable (gh has no --attach)")

echo "--- factory bootstrap report"
echo "node: $(node --version 2>/dev/null || echo missing) (want v$node_version)"
echo "pnpm: $(pnpm --version 2>/dev/null || echo missing)"
echo "uv: $(uv --version 2>/dev/null || echo missing)"
echo "gh: $(gh --version 2>/dev/null | head -n 1 | grep . || echo missing); screenshot attach: $gh_attach_status"
echo "px: $(px --version 2>/dev/null || echo missing)"
if [ "$setup_status" -eq 0 ]; then
  echo "make setup: ok"
else
  echo "make setup: failed (exit $setup_status); last lines of /tmp/factory-setup.log:"
  tail -n 20 /tmp/factory-setup.log
fi
if [ "$pg_status" = ok ]; then
  echo "postgresql: running at $pg_url (data $pg_dir/data, log $pg_dir/server.log)"
  pytest_pg="cd $repo_dir && PYTHONDONTWRITEBYTECODE=1 .venv/bin/python -m pytest -o cache_dir=/tmp/factory-pytest-cache --db all --postgresql-exec $pg_ctl_path <tests>"
  if [ "$(id -u)" -eq 0 ]; then
    echo "pytest on PostgreSQL: run as $pg_user, since the fixtures start their own PostgreSQL:"
    echo "  su $pg_user -s /bin/bash -c '$pytest_pg'"
  else
    echo "pytest on PostgreSQL, since the fixtures start their own PostgreSQL:"
    echo "  $pytest_pg"
  fi
else
  echo "postgresql: $pg_status; rely on CI for --db postgresql"
fi
echo "server for an acceptance test (stop it with kill when the test is done):"
echo "  SQLite:     PHOENIX_WORKING_DIR=/tmp/factory-phoenix PHOENIX_PORT=6006 PHOENIX_GRPC_PORT=4317 uv run --no-sync phoenix serve &"
if [ "$pg_status" = ok ]; then
  echo "  PostgreSQL: PHOENIX_SQL_DATABASE_URL=$pg_url PHOENIX_PORT=6006 PHOENIX_GRPC_PORT=4317 uv run --no-sync phoenix serve &"
fi
echo "  wait for: curl -sf http://127.0.0.1:6006/healthz; OTLP at http://127.0.0.1:6006/v1/traces and grpc 127.0.0.1:4317; UI at http://127.0.0.1:6006"
echo "fresh storage for the acceptance test's after run, with the server stopped:"
echo "  SQLite:     rm -rf /tmp/factory-phoenix"
if [ "$pg_status" = ok ]; then
  echo "  PostgreSQL: $pg_bin/dropdb -h 127.0.0.1 -p $pg_port -U phoenix phoenix && $pg_bin/createdb -h 127.0.0.1 -p $pg_port -U phoenix phoenix"
fi
if [ "$browser_status" = ok ]; then
  echo "browser: ok ($(agent-browser --version 2>/dev/null), Chromium $chromium_path)"
  echo "  an acceptance test that drives the UI starts with these two lines, then uses agent-browser as 'agent-browser skills get core' describes:"
  echo "    export AGENT_BROWSER_EXECUTABLE_PATH=$chromium_path"
  echo "    $browser_launch http://127.0.0.1:6006"
  echo "  the UI needs a built frontend: run 'pnpm -C js/app run build:deps && pnpm -C js/app build' once before a browser run, and again after frontend changes"
  echo "  end the script with 'agent-browser screenshot <path>' and 'agent-browser get text body', then 'agent-browser close'"
else
  echo "browser: $browser_status; test the UI's behavior through the REST or GraphQL API and list the browser steps under Not verified"
fi
