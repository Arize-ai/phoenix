# Testing guide

Run `make test-unit` for isolated behavior and `make test-integration` for adapter and worker flows. `make check` is the standard local gate and must pass independently of test order. Focus a Python test with `uv run pytest path/to/test.py -q` while iterating, then run the relevant owning suite.

Retry and timeout tests use `FakeClock`. It begins at zero and does not move unless the test explicitly advances it. The autouse fixture in `tests/unit/test_ack_timeout.py` currently holds the clock at zero, allowing `test_receipt_times_out_after_deadline` to pass during cleanup without executing the real deadline branch. A sound regression test advances beyond the deadline and asserts the resulting terminal receipt.

Integration workers publish a readiness event. Tests should wait for the event instead of sleeping for an assumed startup duration. Each test uses a unique topic namespace and closes its adapter in teardown.

Capture the exception category as well as command text when diagnosing failures. In version 0.8.2, `relaycache doctor` prints `broker unreachable` for a negative `ack_timeout_ms` because one handler wraps configuration and connection exceptions. The parser rejects that value before any socket is opened. Separate tests should cover invalid configuration and an unavailable broker endpoint.

Coverage can reveal untouched branches, but assertions establish behavior. When a surprising test stays green, inspect autouse fixtures, fake time, and cleanup paths before accepting the result.
