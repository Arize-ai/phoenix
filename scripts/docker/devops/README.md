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
the development datasets, then replays recorded traces into the
`phoenix-datagen` project until you stop it. Use it to get continuous traffic
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

## Commands

```bash
./dev.sh up        # Build changed images and start (DEFAULT - use for code changes)
./dev.sh rebuild   # Full rebuild without cache (slowest - when dependencies change)
./dev.sh down      # Stop all services
./dev.sh destroy   # Wipe data volumes (database, Grafana, Prometheus); keeps images
./dev.sh doctor    # Check Docker, ports, compose config, and image freshness
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
