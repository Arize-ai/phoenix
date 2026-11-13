# Acme support bot

A customer-support bot that answers questions about customers, orders, and store
policies. It calls `gpt-4o-mini` through Acme's LLM gateway and gives the model two
tools: `run_sql` over the store database and `get_policy` for policy documents.

## Run it

The gateway URL comes from `ACME_LLM_GATEWAY_URL`. Default:
`http://127.0.0.1:8100/v1`. For local development, start the fake gateway, which answers
with fixed replies and needs no key:

```bash
python dev/fake_gateway.py &
python support_bot.py
```

`support_bot.py` runs each conversation in `CONVERSATIONS` and prints every answer.
Each conversation has its own ID in `SupportBot.chat`.

## Files

| Path | Contents |
| --- | --- |
| `support_bot.py` | The bot, its tools, and the sample conversations |
| `dev/fake_gateway.py` | A local stand-in for the LLM gateway |
