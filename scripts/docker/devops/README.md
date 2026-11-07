# Phoenix Development Environment

Complete Docker Compose development environment with Phoenix, PostgreSQL, Grafana, Prometheus, and OIDC authentication using Traefik reverse proxy.

## Quick Start

```bash
# Start all services (most common)
./dev.sh up

# Stop all services
./dev.sh down
```

## Access

- **Phoenix**: http://localhost:18273/phoenix/
- **SMTP Mail**: http://localhost:18273/mail/
- **Database**: localhost:5433 (postgres/postgres)
- **Grafana** (`--profile grafana`): http://localhost:18273/grafana. The
  `Phoenix Simple Monitoring` dashboard covers containers, span ingestion,
  online evals, and datagen.
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

See [Synthetic Trace Traffic](../../../DEVELOPMENT.md#synthetic-trace-traffic)
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
3. `overrides/toxiproxy.yml` changes Phoenix's database URL to
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
./dev.sh doctor    # Check Docker, ports, compose config, and image freshness
./dev.sh status    # Show running services and the URLs of the active profiles
./dev.sh profiles  # List the available profiles
./dev.sh env       # Print the environment variables of the Phoenix container
./dev.sh prune     # Remove the Docker build cache to free disk space
./dev.sh help      # Show every command and profile
```

The script uses `docker compose` when the Compose plugin is installed, and
falls back to the standalone `docker-compose` binary.

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
| `Cannot connect to the Docker daemon` | Docker Desktop is not running | Start Docker Desktop |
| Phoenix never becomes healthy | Phoenix crashed during startup | `docker compose logs phoenix` |
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
- [DEVELOPMENT.md](../../../DEVELOPMENT.md): the Phoenix development workflow.
