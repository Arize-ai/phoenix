# OTel contextvars + async generators

Why we avoid **contextvars in async generator cleanup** in the Phoenix playground (chat, evaluators, streaming), and how we proved and designed around it.

- **[Analysis](otel-contextvars-async.md)** — problem, root cause (CPython/asyncio), fixes, and design decisions.
- **Supporting demo** — `contextvars_async_gen_demo.py`: empirical tests (contextvars + async generators, no OTel). Run from repo root:

  ```bash
  uv run python internal_docs/vignettes/otel-contextvars-async/contextvars_async_gen_demo.py
  ```
