# Contributing to RelayCache

Create an isolated Python 3.11 environment, install the `dev` dependency group, and run `make check` before opening a change. `make check` runs formatting, static analysis, and the unit suite. Broker-backed tests are separate: start the local NATS container with `make services-up`, then run `make test-integration`. Do not make a unit test depend on a running broker.

Keep changes narrow and preserve the layering described in `ARCHITECTURE.md`. Public behavior belongs in `src/relaycache/router.py`; retry calculations belong in `src/relaycache/retry.py`. The similarly named `tests/helpers/retries.py` only builds deterministic schedules for assertions and must not be imported by production modules.

New behavior needs one focused success case and a boundary or failure case when that boundary carries distinct behavior. Prefer the fake clock from `tests/helpers/clock.py` for retry tests, but advance it explicitly so the branch under test actually executes. Assertions should cover the returned receipt or emitted adapter call rather than private call counts alone.

`tests/integration/test_dead_letter.py::test_dead_letter_redelivery` is known to fail intermittently on macOS when the worker does not report ready within its 200 ms startup window. A retry of that test usually passes. Changes near worker startup should reproduce and remove the race rather than increase the timeout without evidence.

Commit messages use an imperative subject. Update the README for user-facing APIs and add a changelog fragment under `changes/` for compatibility-visible fixes.
