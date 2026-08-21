# RelayCache architecture

`Router.route(event, *, policy=None)` is the current public coroutine. `Router.dispatch` is a deprecated compatibility alias retained through the next minor release. The router validates topics and payloads, supplies an idempotency key when needed, and creates an immutable delivery envelope.

The routing flow crosses four owners. The router owns the public boundary. The scheduler owns attempt timing and sleeping. `src/relaycache/retry.py` owns pure retry-budget and delay calculations. Broker adapters own transport calls and acknowledgement translation. Moving retry timing into an adapter would make policies differ by transport and is outside the intended design.

A `Receipt` begins in `pending` and may transition once to `acknowledged`, `exhausted`, or `dead_lettered`. Terminal receipts cannot change again. Adapter results are persisted before a terminal receipt becomes visible, preserving agreement between caller state and the adapter ledger.

`src/relaycache/config.py` parses constructor values, environment variables, and TOML input into validated settings before transport setup. The doctor command uses that parser and then probes the chosen adapter. It should report validation and connectivity as separate failure classes.

Unit tests use deterministic adapters and clocks. Integration tests own disposable broker lifecycles. Helpers under `tests/helpers` may mirror production terminology but are not shared runtime code. Cross-layer changes should retain these ownership boundaries even when their implementation spans multiple files.
