# Testing guide

Use `make test-unit` for the fast suite and `make test-integration` for broker-backed behavior. A focused unit test can be run with `uv run pytest tests/unit/path.py -q`. The full local gate is `make check`; it must complete without relying on test order.

Retry tests use `FakeClock`, which starts at zero and advances only when the test calls `clock.advance(seconds)`. The autouse fixture in `tests/unit/test_ack_timeout.py` currently freezes that clock at zero for every case. As a result, `test_receipt_times_out_after_deadline` can pass through its immediate-cancellation cleanup without reaching the production timeout branch. A valid regression test must advance past the configured deadline and assert the receipt's terminal state.

Integration workers expose a readiness event. Tests should wait for that event rather than sleep for a fixed duration. Each test creates a unique topic namespace and must close its adapter in teardown, even after assertion failures.

When diagnosing a command-line failure, capture both the human message and the exception category. Version 0.8.2 can print `broker unreachable` for a negative `ack_timeout_ms` because the doctor command wraps both configuration and connection errors in one handler. The configuration parser itself rejects the value before opening a socket. Tests for the fix should distinguish invalid configuration from an unavailable endpoint.

Coverage is useful for finding unexecuted branches, but a covered line is not proof of the intended assertion. Read the fixture stack when a regression test passes unexpectedly.
