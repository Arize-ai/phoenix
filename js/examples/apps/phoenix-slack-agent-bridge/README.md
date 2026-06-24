# Phoenix Slack Agent Bridge

Prototype Slack bridge for the Phoenix server agent chat endpoint. The bridge
uses Chat SDK's Slack adapter, keeps thread state in memory, and forwards Slack
thread history to Phoenix's existing `/agents/server/sessions/{session_id}/chat`
route.

This is a local testing app. It does not change Phoenix server behavior and it
does not persist subscriptions across restarts.

## Setup

Install dependencies from the `js` workspace root:

```bash
cd js
pnpm install
```

Create a local env file:

```bash
cp examples/apps/phoenix-slack-agent-bridge/.env.example examples/apps/phoenix-slack-agent-bridge/.env
```

Fill in:

- `SLACK_BOT_TOKEN`
- `SLACK_SIGNING_SECRET`
- `PHOENIX_AUTH_TOKEN`, only if Phoenix auth is enabled

Run Phoenix locally with the server agent enabled, then start the bridge:

```bash
cd js
pnpm --filter phoenix-slack-agent-bridge dev
```

The bridge listens on `http://localhost:8787` by default.

## Slack App Configuration

Create a Slack app and install it to your test workspace.

Add bot token scopes:

- `chat:write`
- `app_mentions:read`
- `im:history` and `im:write` for DM testing
- `groups:history` for private-channel testing

Enable Event Subscriptions and set the request URL to:

```text
https://<ngrok-or-cloudflared-url>/api/webhooks/slack
```

Subscribe to bot events:

- `app_mention`
- `message.im`, if you want DM testing

For local testing, expose port `8787` with ngrok or cloudflared.

## Verification

Check the health endpoint:

```bash
curl http://localhost:8787/health
```

Mention the app in a Slack channel. The bridge subscribes to that thread, sends
the full thread history to Phoenix, and streams Phoenix text deltas back into the
Slack thread. Replies in the same thread reuse the same Phoenix session id.
