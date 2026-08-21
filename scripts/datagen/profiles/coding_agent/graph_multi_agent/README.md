# RelayCache

RelayCache is a Python library for routing durable application events across broker implementations. Producers work with one `Router`, while adapters translate delivery envelopes to NATS, Redis Streams, or an in-memory test transport. Retry, acknowledgement, and idempotency rules remain consistent across adapters.

The basic asynchronous API is shown below:

```python
from relaycache import Event, Router

router = Router.from_url("nats://localhost:4222")
receipt = await router.dispatch(Event(topic="orders.accepted", payload={"order_id": "o-17"}))
await receipt.acknowledged()
```

RelayCache supports Python 3.11 and later. Explicit constructor values take precedence over `RELAYCACHE_` environment variables and `relaycache.toml`. The default retry policy allows five attempts with exponential backoff capped at 30 seconds. Stable idempotency keys allow adapters to suppress duplicate acceptance during their configured deduplication window.

Library code lives under `src/relaycache`. Fast tests live in `tests/unit`, service-backed tests in `tests/integration`, and reusable test fixtures in `tests/helpers`. `python -m relaycache doctor` checks parsed configuration before probing the configured broker.

Public changes require compatibility coverage and a changelog fragment. The architecture guide owns the current module boundaries and API lifecycle; examples should be updated when they drift from that guide.
