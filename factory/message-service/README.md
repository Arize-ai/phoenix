# Factory message service

Talk to `@Foreman` in Slack.

## Run locally

Copy `.env.example` to `.env.local` in this directory and fill in the values.
From the repository root:

```sh
make install-node
make db-migrate-factory-message-service
make dev-factory-message-service
```

The service runs at `http://localhost:3109`. Use an HTTPS tunnel for webhook access.

Existing setups: rename `FACTORY_COORDINATOR_AGENT_ID` and
`FACTORY_COORDINATOR_ENVIRONMENT_ID` to `FACTORY_FOREMAN_AGENT_ID` and
`FACTORY_FOREMAN_ENVIRONMENT_ID`, keeping their values, then run the migration.

## Commands

```sh
make format-factory-message-service
make lint-factory-message-service
make typecheck-factory-message-service
make test-factory-message-service
make db-types-factory-message-service
make build-factory-message-service
make start-factory-message-service
```
