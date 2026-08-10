# arize-phoenix-executors

Shared internal building blocks for the Phoenix Python packages.

This package holds one copy of the rate limiter and the task executors that
`arize-phoenix-client` and `arize-phoenix-evals` both depend on. It exists so those two packages
share a single implementation — and, just as importantly, a single set of exception *class objects*,
because the executors classify failures with `isinstance` checks that only work when both sides
agree on identity.

## Not a public API

`arize-phoenix-executors` is an implementation detail of the other Phoenix packages. It carries no
API stability promise, and its contents may change or disappear in any release. Install it directly
only if you are developing Phoenix itself; everyone else gets it transitively.

The user-facing entry points remain:

- [`arize-phoenix-client`](https://pypi.org/project/arize-phoenix-client/)
- [`arize-phoenix-evals`](https://pypi.org/project/arize-phoenix-evals/)

## Contents

| Module | What it holds |
|---|---|
| `phoenix.executors.exceptions` | `PhoenixException`, the base of every Phoenix error the executors treat as internal |
| `phoenix.executors.rate_limiters` | `RateLimiter`, `AdaptiveTokenBucket`, `RateLimitError`, `UnavailableTokensError` |
| `phoenix.executors.executors` | `AsyncExecutor`, `SyncExecutor`, `ConcurrencyController`, `get_executor_on_sync_context` |
