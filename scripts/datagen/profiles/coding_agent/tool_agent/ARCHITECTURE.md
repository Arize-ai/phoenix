# RelayCache architecture

The public asynchronous entry point is `Router.route(event, *, policy=None)`. `Router.dispatch` remains a deprecated compatibility alias through the next minor release. Routing validates the topic and payload, assigns an idempotency key when the caller did not provide one, and creates an immutable delivery envelope.

The router passes that envelope to a broker adapter. Adapters implement `publish`, `await_ack`, and `move_to_dead_letter`; they do not calculate retry delays. `src/relaycache/retry.py` owns attempt budgets and exponential delay calculation. The scheduler owns sleeping, so retry functions remain deterministic and accept an attempt number plus policy.

Acknowledgement state is represented by a `Receipt`. A receipt may move from `pending` to `acknowledged`, `exhausted`, or `dead_lettered`; terminal states never transition again. The router records the adapter result before exposing a terminal receipt so callers cannot observe an acknowledgement that is absent from the adapter ledger.

Configuration parsing lives in `src/relaycache/config.py`. It produces validated values before any broker connection is attempted. The command-line doctor uses the same parser, then probes the selected adapter. Validation failures should identify the invalid setting; connectivity failures should identify the adapter endpoint.

Tests mirror these boundaries. Unit tests use deterministic adapters and clocks. Integration tests exercise adapter implementations against disposable services. Code in `tests/helpers` is test-only support and is intentionally allowed to resemble production concepts without sharing production imports.
