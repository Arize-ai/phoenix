# Factory Foreman

Talk to `@Foreman` in Slack.
Foreman can search and read the public web; worker actions use Factory MCP.

Run a long-lived Node service with Postgres and pnpm. Worker starts dispatch the
existing GitHub Actions workflows; Actions owns admission, credential refresh,
monitoring and completion. The running Node service deletes expired OAuth grants
once an hour; sessions and Slack mappings are retained.

## Setup

1. Copy [.env.example](./.env.example) to `.env.local` and fill in the values.
   MCP URL and signing secret are required for every Foreman.
   Worker starts need a maintainer-owned fine-grained `FACTORY_GITHUB_TOKEN` with
   Actions write and repository metadata read, repository/user allowlists, and
   Slack-to-GitHub identity mappings. `FACTORY_WORKFLOW_REF` must contain the
   updated Factory workflows. Their `factory-state` lock must use
   `ANTHROPIC_WORKSPACE_ID`, shared with Foreman. Factory GitHub App credentials
   stay in Actions secrets.
2. Run `ant apply` in `managed-agents/` and save the Foreman agent/environment IDs.
3. Configure public HTTPS endpoints: Slack events at `/api/slack/events`, MCP at
   `/api/mcp`, and the Anthropic webhook at `/api/anthropic/webhooks` for
   `session.status_idled` and `session.status_terminated`. Save its signing key.
   Expose the MCP URL's `/oauth/token` and `/oauth/revoke` subpaths too.

## Run

From the repository root:

```sh
make install-node
make db-migrate-factory-foreman
make dev-factory-foreman
```

Local development runs at `http://localhost:3109`; use HTTPS tunnels for external
access. For deployment, replace the dev command with
`make build-factory-foreman` and `make start-factory-foreman`.
Restart after environment changes; unset inherited Anthropic credentials if they
override `.env.local`.

Mention Foreman in a **new Slack thread**. Verify session discovery, reading, a
worker follow-up and returned reply, then a start on a test issue/PR. Starts return
a queued workflow link; admission failures are reported on GitHub. Start new
threads after changing the MCP URL or signing secret.
After this auth upgrade, use a new thread. Anthropic refreshes five-minute access
tokens automatically; each revocable grant expires after 90 days. Refresh-token
reuse revokes the grant, including concurrent duplicate refreshes.

## Commands

```sh
make format-factory-foreman
make lint-factory-foreman
make typecheck-factory-foreman
make test-factory-foreman
make db-types-factory-foreman
make db-model-factory-foreman
```
