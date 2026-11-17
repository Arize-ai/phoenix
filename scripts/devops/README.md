# Phoenix Development Environment

Complete local development environment with Phoenix, PostgreSQL, Grafana, Prometheus, Tempo, Loki, OpenTelemetry Collector, and OIDC authentication behind Traefik. It runs on **Kubernetes** (Apple `container cluster` or `kind`, deploying Phoenix via [`../../helm`](../../helm)) or **Compose** (Podman or Docker) through a single `./dev.sh` CLI.

## Quick Start

```bash
# Start all services (auto-selects Apple container K8s on macOS 26+, or running Docker/Podman)
./dev.sh up
# (or from the repository root: make dev-stack)

# Start with self-instrumentation & monitoring (Grafana + Prometheus + Tempo + Loki)
./dev.sh up --profile grafana

# Explicitly choose an engine (container | kind | docker | podman)
./dev.sh up --engine container
./dev.sh up --engine docker

# Stop all services
./dev.sh down
```

## Container / Cluster Engine

`./dev.sh` supports four engines under one roof (`PHOENIX_DEV_ENGINE` or `--engine`):

- **Apple `container` (Kubernetes, default on macOS 26+ when installed)**: `brew install container kubectl helm jq`. Deploys Phoenix via [`../../helm`](../../helm) and Kustomize manifests (`k8s/manifests/`), using an isolated kubeconfig at `.state/kubeconfig` (never touching `~/.kube/config`) and a localhost TCP gateway container on the cluster `vmnet`.
- **`kind` (Kubernetes on Linux / Docker)**: `brew install kind kubectl helm jq`. Uses `--engine kind`.
- **Podman (Compose)**: `brew install podman docker-compose`, then `podman machine init` and `podman machine start`. Give the machine room if you will seed performance data, for example `podman machine init --cpus 8 --memory 12288 --disk-size 80`. Uses `--engine podman` (`compose/`).
- **Docker (Compose)**: any Docker engine with the Compose plugin (`--engine docker`, `compose/`).

When `PHOENIX_DEV_ENGINE` / `--engine` is not specified, `./dev.sh` prefers Apple `container` if installed, then a running Docker or Podman daemon, then `kind`. `./dev.sh doctor` reports what is active or missing.

## Access

- **Phoenix**: http://localhost:18273/phoenix/
- **SMTP Mail**: http://localhost:18273/mail/
- **Database**: localhost:5433 (postgres/postgres)
- **Grafana** (`--profile grafana`): http://localhost:18273/grafana/ (Prometheus, Tempo, and Loki datasources pre-provisioned with trace-to-logs correlation). The `Phoenix Simple Monitoring` dashboard covers containers, span ingestion, online evals, and datagen.
- **Tempo / Loki / OTel Collector** (`--profile grafana`): `http://localhost:3200` (Tempo), `http://localhost:3100` (Loki), `localhost:14317` / `http://localhost:14318` (OTLP gRPC / HTTP)
- **Prometheus** (`--profile grafana`): http://localhost:18273/prometheus/, for
  ad-hoc queries. It scrapes Phoenix, cAdvisor, the Postgres exporter, and
  datagen's `/metrics` when the `datagen` profile is running.
- **Mock LLM** (`--profile mock-llm`): http://localhost:18273/mock-llm/dashboard/
- **Toxiproxy controls** (`--profile toxiproxy`): http://localhost:18273/toxiproxy/.
  See [Database Latency](#database-latency-toxiproxy).

## Profiles

A profile adds services or changes how Phoenix is configured. Select one with
`--profile NAME`, or several with `--profiles NAME1,NAME2`:

```bash
./dev.sh up --profiles grafana,mock-llm,datagen,toxiproxy
```

Pass the same profiles to `./dev.sh doctor` and `./dev.sh status`, so that they
check and report the services of those profiles.

| Profile | What it does |
| --- | --- |
| *(none)* | Phoenix with PostgreSQL, OIDC, SMTP, and Traefik. The frontend is a production build. |
| `vite` | Serves the frontend from the Vite dev server, with hot reload. |
| `grafana` | Adds Grafana, Prometheus, cAdvisor, and the Postgres exporter. |
| `lgtm` | Adds the all-in-one Grafana stack and the Grafana MCP server. See [Metrics, Logs, and Traces](#metrics-logs-and-traces-lgtm). |
| `mock-llm` | Adds the mock LLM server. See [Mock LLM Server](#mock-llm-server). |
| `datagen` | Replays synthetic traces. See [Synthetic Trace Traffic](#synthetic-trace-traffic). |
| `toxiproxy` | Adds network latency between Phoenix and PostgreSQL. See [Database Latency](#database-latency-toxiproxy). |
| `in-memory` | Uses in-memory SQLite instead of PostgreSQL. Data is lost when Phoenix stops. |
| `basic-auth` | Uses username and password login. |
| `pkce-public` | Uses OIDC with PKCE, as a public client (no client secret). |
| `pkce-confidential` | Uses OIDC with PKCE, as a confidential client (with a client secret). |
| `ldap` | Adds a mock LDAP server and enables LDAP login. |
| `ldap-no-email` | LDAP with users that have no email address. |
| `ldap-posix` | LDAP with POSIX groups (`memberUid`) instead of `memberOf`. |
| `ldap-test` | Runs the adversarial LDAP TLS tests. See [LDAP-TLS-TESTING.md](LDAP-TLS-TESTING.md). |
| `schema=NAME` | Stores Phoenix tables in the PostgreSQL schema `NAME`. |

## Metrics, Logs, and Traces (LGTM)

The `lgtm` profile collects Phoenix's metrics, logs, and traces in one
container and adds an MCP server for agents, so that a performance problem can
be reproduced and measured locally:

```bash
./dev.sh up --profiles lgtm,datagen
```

- **Grafana**: http://localhost:18273/lgtm/. It is the `grafana/otel-lgtm`
  image: Grafana, Prometheus, Loki, Tempo, and an OpenTelemetry Collector in
  one container. This local profile needs no login.
- **Grafana MCP**: http://localhost:18273/grafana-mcp/mcp. A read-only MCP
  server (`grafana/mcp-grafana`) with the datasource, Loki, Tempo, and
  Prometheus tools, for agents. It needs no token.

Use `lgtm` or `grafana`, not both: each profile points Phoenix's traces and
logs at its own collector. `grafana` runs Grafana, Prometheus, Tempo, and Loki
as separate services behind the OIDC login, with container and PostgreSQL
metrics. `lgtm` is one container with no login, and it includes the MCP server.

Phoenix sends its traces and logs to the collector over OTLP. The collector
pulls Phoenix's metrics from port 9090 as the job `phoenix`
([lgtm/otelcol-phoenix.yaml](lgtm/otelcol-phoenix.yaml)). The datasource UIDs
are `prometheus`, `loki`, and `tempo`, the same as in the hosted environment,
so a query written against one works against the other.

The dashboards in [lgtm/dashboards](lgtm/dashboards) and the alert rules in
[lgtm/provisioning/alerting](lgtm/provisioning/alerting) are loaded when
Grafana starts. These files are the source of truth. To change a dashboard,
edit it in Grafana, export its JSON, and replace the file.

## Mock LLM Server

`mock-llm-server/` mocks the OpenAI, Anthropic, Gemini, and TypeSafe APIs. See
[its README](mock-llm-server/README.md). Run it in one of two ways:

- **In the stack:** `./dev.sh up --profile mock-llm`. The dashboard is
  http://localhost:18273/mock-llm/dashboard/. Phoenix reaches the API at
  `http://mock-llm:57593/v1` on the Docker network. The container does not
  publish that port on the host.
- **On the host:** `make dev-mock-llm` from the repository root, at
  http://localhost:57593/dashboard/.

## Synthetic Trace Traffic

`./dev.sh up --profile datagen` runs `phoenix datagen` in the stack. It seeds
the development datasets, then replays recorded traces until you stop it. The
stack does not pass `--project`, so datagen sends each recorded application to
its own project, for example `support-chatbot`. Use it to get continuous traffic
for online evals and the Grafana panels. Combine it with other profiles, for
example `--profiles datagen,grafana`.

- It runs the `devops-phoenix` image that the `phoenix` service builds, so it
  needs no separate build and always matches the running server.
- It authenticates with the stack's `PHOENIX_ADMIN_SECRET`, so you do not need
  to create an API key.
- The corpus and dataset downloads are cached in the `dev_datagen_cache`
  volume, so restarts do not download them again.
- Change the rate, change burstiness, pause, or send a burst of traces at
  http://localhost:18273/datagen/. Changes take effect immediately and reset
  when the container restarts.
- Follow its output with `docker compose logs -f datagen`.

See [Synthetic Trace Traffic](../../DEVELOPMENT.md#synthetic-trace-traffic)
for what it seeds and replays.

## Database Latency (Toxiproxy)

Without this profile, Phoenix and PostgreSQL communicate over the Docker bridge
network. Each database round trip then takes much less than a millisecond. A
production deployment has a network between Phoenix and its database, and each
round trip takes about 1 to 3 ms in the same cloud region. Code that makes many
small queries can be fast locally and slow in production. This profile makes
that cost visible in the development stack.

`./dev.sh up --profile toxiproxy` does these things:

1. It starts [Toxiproxy](https://github.com/Shopify/toxiproxy), a TCP proxy that
   can add latency, bandwidth limits, and other network faults.
2. `toxiproxy-init` creates the proxy `postgres` from `toxiproxy:5433` to
   `db:5433`, and adds a latency of 2 ms ±1 ms. The toxic applies to the
   downstream direction (PostgreSQL to Phoenix) only, so each query round trip
   takes about 2 ms more.
3. `compose/overrides/toxiproxy.yml` (or `k8s/values/toxiproxy.yaml`) changes Phoenix's database URL to
   `toxiproxy:5433`. Phoenix starts only after `toxiproxy-init` is complete.

Only Phoenix connects through the proxy. These clients connect to `db`
directly and get no delay:

- `localhost:5433` on the host, for example `psql` or a database GUI.
- The Postgres exporter, so its metrics show the database without the delay.

The `datagen` service sends traces to Phoenix over HTTP, not to the database.
Its traffic therefore gets the delay when Phoenix writes the spans.

### Change the Network Conditions

Changes take effect immediately, also on Phoenix's open connections. Phoenix
does not restart.

**Control page:** http://localhost:18273/toxiproxy/. On this page you can:

- Apply a preset from the table below.
- Set the latency and the jitter, in one direction or in both directions.
- Add a fault: a bandwidth limit, a slow close, a timeout, a connection reset,
  or a data limit. Each fault applies to one direction, and to a share of the
  connections that you select.
- Cut the connection to simulate a database outage, and restore it.
- See and remove the active toxics. The page refreshes every 3 seconds.

**Script:** `scripts/toxiproxy-scenario.sh` applies the same presets from the
terminal. It needs `curl` and `jq` on the host.

```bash
./scripts/toxiproxy-scenario.sh status        # Show the proxy and its toxics
./scripts/toxiproxy-scenario.sh cross-region  # Apply a preset
```

A preset removes the active toxics, then adds its own:

| Scenario | Toxics | Use it to |
| --- | --- | --- |
| `localhost` | None | Measure a baseline with no delay. |
| `same-region` | 2 ms ±1 ms latency (the default) | Approximate a database in the same cloud region. |
| `aurora` | 3 ms ±2 ms latency, and a 100 ms delay on connection close | Approximate Amazon Aurora in the same availability zone. |
| `cross-region` | 75 ms ±15 ms latency, and a 10 MB/s bandwidth limit | Find query patterns whose cost grows with the number of round trips. |
| `bad-network` | 200 ms ±100 ms latency, and a 1 MB/s bandwidth limit | Test timeouts, retries, and connection pool exhaustion. |

The page and the script call the
[Toxiproxy HTTP API](https://github.com/Shopify/toxiproxy#http-api) at
http://localhost:18273/toxiproxy/api/. The `toxiproxy-ui` service (nginx)
serves the page and forwards that path to Toxiproxy. Toxiproxy refuses requests
from browsers, so that web pages cannot change the toxics. The forwarding
replaces that protection: it accepts only requests with the header
`X-Requested-With: toxiproxy-ui`, which a page on another origin cannot send.
Add the header when you call the API directly:

```bash
curl -H 'X-Requested-With: toxiproxy-ui' http://localhost:18273/toxiproxy/api/proxies
```

Toxiproxy keeps the proxy and the toxics in memory. If the `toxiproxy`
container restarts, they are lost and Phoenix cannot reach the database. Run
`./dev.sh up --profile toxiproxy` again to run `toxiproxy-init` again.

## Commands

```bash
./dev.sh up        # Build changed images and start (DEFAULT - use for code changes)
./dev.sh rebuild   # Full rebuild without cache (slowest - when dependencies change)
./dev.sh down      # Stop all services
./dev.sh reset     # Remove the stack's images, so the next 'up' rebuilds them
./dev.sh destroy   # Wipe data volumes (database, Grafana, Prometheus); keeps images
./dev.sh doctor    # Check the container engine, ports, compose config, and image freshness
./dev.sh status    # Show running services and the URLs of the active profiles
./dev.sh profiles  # List the available profiles
./dev.sh env       # Print the environment variables of the Phoenix container
./dev.sh prune     # Remove the build cache to free disk space
./dev.sh seed      # Fill the database with performance test data (--scale N; PostgreSQL only)
./dev.sh seed-tail # Add fresh traffic to the seeded busy projects
./dev.sh psql      # Open psql in the database container, or pipe SQL to it
./dev.sh help      # Show every command and profile
```

With Docker, the script uses `docker compose` when the Compose plugin is
installed, and falls back to the standalone `docker-compose` binary. With
Podman, it uses `podman compose`, which runs `docker-compose` against Podman.

## Which Command to Use?

- **Something broken?** → `./dev.sh doctor`
- **Changed code?** → `./dev.sh up`
- **Dependencies changed?** → `./dev.sh rebuild`
- **Need a fresh database?** → `./dev.sh destroy`, then `./dev.sh up`

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| A UI is blank and its assets return 404 | The container runs an image built from older source | `./dev.sh up` |
| `port is already allocated` | Another process holds 18273 or 5433 | `./dev.sh doctor` names the port |
| `Cannot connect to the Docker daemon` or `Cannot connect to Podman` | The engine is not running | `podman machine start`, or start Docker |
| Phoenix never becomes healthy | Phoenix crashed during startup | `podman logs devops-phoenix-1` (or `docker logs`) |
| Every URL returns 404 under Podman | Traefik cannot read the engine socket | Check `podman logs devops-traefik-1` for `permission denied` |
| Phoenix exits with code 137 | The container used more memory than its limit (`docker inspect` shows `OOMKilled`) | Lower the datagen rate, then `./dev.sh up` |
| Phoenix loses the database with the `toxiproxy` profile | The `toxiproxy` container restarted and lost its proxy | `./dev.sh up --profile toxiproxy` |
| The Toxiproxy page or `toxiproxy-scenario.sh` cannot connect | The `toxiproxy` profile is not running | `./dev.sh up --profile toxiproxy` |
| The Toxiproxy page says the `postgres` proxy does not exist | `toxiproxy-init` did not run after Toxiproxy started | `./dev.sh up --profile toxiproxy` |

## Other Documentation

- [vignettes/online-eval-load-testing.md](vignettes/online-eval-load-testing.md):
  for an agent that sets up the stack so that a user can load test online
  evaluations.
- [LDAP-TLS-TESTING.md](LDAP-TLS-TESTING.md): the LDAP TLS tests and their
  adversarial proxy.
- [mock-llm-server/README.md](mock-llm-server/README.md): the mock LLM server.
- [DEVELOPMENT.md](../../DEVELOPMENT.md): the Phoenix development workflow.
