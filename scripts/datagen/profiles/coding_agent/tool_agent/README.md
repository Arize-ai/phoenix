# RelayCache

RelayCache is a small Python library for routing durable application events to one or more brokers. It keeps producer code independent of a particular broker, applies retry and acknowledgement policies consistently, and exposes enough structured state for operators to explain a delivery.

Applications create a `Router` with a broker adapter and then dispatch an event:

```python
from relaycache import Event, Router

router = Router.from_url("nats://localhost:4222")
receipt = await router.dispatch(Event(topic="billing.invoice.created", payload={"id": "inv-42"}))
await receipt.acknowledged()
```

The default policy makes five delivery attempts with exponential backoff capped at 30 seconds. A producer may supply a stable idempotency key; when it does, RelayCache prevents the same event from being accepted twice within the broker adapter's deduplication window.

The package supports Python 3.11 and later. Run `python -m relaycache doctor` to validate local configuration and broker connectivity. Configuration is loaded from explicit constructor arguments, then `RELAYCACHE_` environment variables, then `relaycache.toml`. The repository contains the library under `src/relaycache`, unit tests under `tests/unit`, and broker-backed integration tests under `tests/integration`.

Public compatibility matters: deprecations remain available for at least one minor release and emit `DeprecationWarning`. The architecture guide is the authoritative description of routing flow and module ownership.
