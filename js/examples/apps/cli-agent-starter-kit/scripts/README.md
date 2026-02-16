# Scripts

Utility scripts for testing and development.

## test-session-tracking.sh

Tests that session tracking works correctly by simulating a multi-turn conversation.

**What it does:**
- Sends 3 different queries to the agent in sequence
- Each query creates a separate trace
- All traces should share the same `session.id`

**Usage:**
```bash
./scripts/test-session-tracking.sh
```

**Verification:**
After running, check Phoenix to verify all traces have the same session ID:
```bash
npx @arizeai/phoenix-cli traces \
  --endpoint http://localhost:6006 \
  --project cli-agent-starter-kit \
  --limit 5 \
  --format raw \
  --no-progress | \
  jq '.[] | {traceId: .traceId, sessionId: .spans[0].attributes["session.id"]}'
```

## ensure-phoenix.sh

Ensures Phoenix is running locally (existing script from project setup).
