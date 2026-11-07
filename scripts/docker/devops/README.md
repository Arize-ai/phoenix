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