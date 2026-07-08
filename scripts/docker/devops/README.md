# Phoenix Development Environment

Complete Docker Compose development environment with Phoenix, PostgreSQL, Grafana, Prometheus, and OIDC authentication using Traefik reverse proxy.

## Quick Start (via Tox)

```bash
# Start all services (most common)
tox r -e docker_devops

# Stop all services  
tox r -e docker_devops -- down
```

## Access

- **Phoenix**: http://localhost:18273/phoenix/
- **SMTP Mail**: http://localhost:18273/mail/
- **Database**: localhost:5433 (postgres/postgres)

## Commands (via Tox)

```bash
tox r -e docker_devops           # Rebuild + start (DEFAULT - use for code changes)
tox r -e docker_devops -- rebuild # Full rebuild (slowest - when dependencies change)
tox r -e docker_devops -- down    # Stop all services
tox r -e docker_devops -- destroy # Nuclear option (wipes all data!)
```

## Which Command to Use?

- **Changed code?** → `tox r -e docker_devops`
- **Dependencies changed?** → `tox r -e docker_devops -- rebuild`
- **Need fresh start?** → `tox r -e docker_devops -- destroy`

## Alternative: Direct Script Usage

You can also use the dev.sh script directly:

```bash
./dev.sh up          # Same as tox r -e docker_devops
./dev.sh rebuild     # Same as tox r -e docker_devops -- rebuild
./dev.sh down        # Same as tox r -e docker_devops -- down
./dev.sh destroy     # Same as tox r -e docker_devops -- destroy
```