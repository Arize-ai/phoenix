# Contributing to RelayCache

Install the `dev` dependency group in Python 3.11 or later. Run `make check` for formatting, type checks, and unit tests. Start disposable broker services with `make services-up` and run `make test-integration` when a change crosses an adapter, scheduler, or worker boundary.

Respect module ownership. `src/relaycache/router.py` validates public requests and coordinates delivery. `src/relaycache/retry.py` calculates attempt budgets and delays. Broker adapters publish envelopes and report acknowledgements. The file `tests/helpers/retries.py` is a test-data builder with production-like names; production modules must not import it.

Behavioral changes need a focused success assertion and, when distinct, a boundary or failure assertion. Fake clocks advance only when the test requests it. Verify the state or adapter effect a caller observes rather than relying only on mock call counts.

The integration case `tests/integration/test_dead_letter.py::test_dead_letter_redelivery` intermittently fails on macOS. Its worker has a fixed 200 ms startup window and may receive the first event before signaling readiness. Re-running usually succeeds. A repair should synchronize on readiness rather than hide the race behind a larger unconditional sleep.

Keep commits cohesive. User-visible API changes update examples and receive a changelog fragment. Deprecated public names remain available for one minor release unless the compatibility policy explicitly says otherwise.
