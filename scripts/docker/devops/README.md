# Phoenix Development Environment

Complete Docker Compose development environment with Phoenix, PostgreSQL, Grafana, Prometheus, Tempo, Loki, OpenTelemetry Collector, and OIDC authentication using Traefik reverse proxy.

## Quick Start

```bash
# Start all services (most common)
./dev.sh up

# Start with self-instrumentation & monitoring (Grafana + Prometheus + Tempo + Loki)
./dev.sh up --profile grafana

# Stop all services
./dev.sh down
```

## Access

- **Phoenix**: http://localhost:18273/phoenix/
- **SMTP Mail**: http://localhost:18273/mail/
- **Database**: localhost:5433 (postgres/postgres)
- **Grafana** (`--profile grafana`): http://localhost:18273/grafana/ (Prometheus, Tempo, and Loki datasources pre-provisioned with trace-to-logs correlation)
- **Tempo / Loki / OTel Collector** (`--profile grafana`): `http://localhost:3200` (Tempo), `http://localhost:3100` (Loki), `localhost:14317` / `http://localhost:14318` (OTLP gRPC / HTTP)

## Commands

```bash
./dev.sh up        # Rebuild + start (DEFAULT - use for code changes)
./dev.sh rebuild   # Full rebuild (slowest - when dependencies change)
./dev.sh down      # Stop all services
./dev.sh destroy   # Nuclear option (wipes all data!)
```

## Which Command to Use?

- **Changed code?** → `./dev.sh up`
- **Dependencies changed?** → `./dev.sh rebuild`
- **Need fresh start?** → `./dev.sh destroy`