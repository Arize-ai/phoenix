# Factory message service

Talk to `@Foreman` in Slack.

Run a long-lived Node service with Postgres, the repository checkout, pnpm, `uv`,
and `gh`. Worker starts launch Python watchers that must stay running; watchers
are not automatically restarted.

## Setup

1. Copy [.env.example](./.env.example) to `.env.local` and fill in the values.
   Worker starts need GitHub App credentials, repository/user allowlists, and
   Slack-to-GitHub identity mappings. `FACTORY_WORKER_LOCK_FILE` must point to
   existing worker resources in `ANTHROPIC_WORKSPACE_ID`, shared with Foreman.
2. Run `ant apply` in `managed-agents/` and save the Foreman agent/environment IDs.
3. Configure public HTTPS endpoints: Slack events at `/api/slack/events`, MCP at
   `/api/mcp`, and the Anthropic webhook at `/api/anthropic/webhooks` for
   `session.status_idled` and `session.status_terminated`. Save its signing key.

## Run

From the repository root:

```sh
make install-node
make db-migrate-factory-message-service
make dev-factory-message-service
```

Local development runs at `http://localhost:3109`; use HTTPS tunnels for external
access. For deployment, replace the dev command with
`make build-factory-message-service` and `make start-factory-message-service`.
Restart after environment changes; unset inherited Anthropic credentials if they
override `.env.local`.

Mention Foreman in a **new Slack thread**. Verify session discovery, reading, a
worker follow-up and returned reply, then a start on a test issue/PR. Start new
threads after changing the MCP URL or signing secret.

## Commands

```sh
make format-factory-message-service
make lint-factory-message-service
make typecheck-factory-message-service
make test-factory-message-service
make db-types-factory-message-service
make db-model-factory-message-service
```
