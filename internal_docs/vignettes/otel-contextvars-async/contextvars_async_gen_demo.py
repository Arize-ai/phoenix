"""Empirical test: contextvars + async generator suspend/resume.

Demonstrates that a token created in an async generator before yield can be
invalid in that generator's finally after the consumer raises; reset(token)
fails with ValueError ("Token was created in a different Context"). This
justifies not relying on contextvars inside async generators that are
consumed across suspend/resume (e.g. chat_completion_create).

Consumer (evaluator) scenario: when the consumer sets context and does
async for over a generator that raises, our tests show the consumer's token
remains valid in the consumer's finally. So we do not reproduce a consumer-side
failure; avoiding start_as_current_span in evaluate is defensive (same
mechanism class, explicit otel_context is safer).

Run from repo root:
  uv run python internal_docs/vignettes/otel-contextvars-async/contextvars_async_gen_demo.py
No pytest: uses asyncio + assert only, to avoid test-framework confounders.
"""

import asyncio
from contextlib import aclosing
from contextvars import ContextVar

cv = ContextVar[float]("x", default=42)


async def f():
    # Set value and get token in Context A
    token = cv.set(3.14)
    print(f"Generator set cv to: {cv.get()}")

    try:
        yield 1
    finally:
        # We're now in Context B (due to exception from main)
        print(f"Finally block inside generator: {cv.get()}")

        try:
            cv.reset(token)  # This fails
        except ValueError as exc:
            print(f"✗ Token reset failed: {exc}")


async def main():
    print(f"Initial default: {cv.get()}")

    try:
        async for _ in f():
            raise RuntimeError()
    except RuntimeError:
        print("Handling RuntimeError")

    # Value persists because token reset failed
    print(f"After generator: {cv.get()}")


async def f_normal():
    """Generator that yields twice and exits normally."""
    token = cv.set(100.0)
    print(f"  [gen] set cv to: {cv.get()}")
    try:
        yield 1
        print(f"  [gen] after first yield, cv.get() = {cv.get()}")
        yield 2
        print(f"  [gen] after second yield, cv.get() = {cv.get()}")
    finally:
        print(f"  [gen] finally: cv.get() = {cv.get()}")
        try:
            cv.reset(token)
            print("  [gen] reset(token) OK")
        except ValueError as exc:
            print(f"  [gen] ✗ reset failed: {exc}")


async def main_normal():
    """Normal async for (no exception). Does context survive suspend/resume?"""
    print("--- Normal async for (no exception) ---")
    print(f"Before loop: {cv.get()}")
    async for x in f_normal():
        print(f"  [main] got {x}, cv.get() = {cv.get()}")
    print(f"After loop: {cv.get()}")


async def gen_that_yields_then_raises():
    """Simulates chat_completion_create: yields once, then raises (e.g. API error)."""
    yield 1
    raise RuntimeError("simulated client error")


async def consumer_with_context():
    """
    Simulates the EVALUATOR: consumer sets context (like start_as_current_span),
    then does async for over a generator that raises. When we exit (due to exception),
    does our token reset in finally still work?
    """
    token = cv.set("evaluator_span")
    try:
        async for chunk in gen_that_yields_then_raises():
            pass
    finally:
        # This is like the __exit__ of start_as_current_span (detach current span).
        try:
            cv.reset(token)
            print("  [consumer] reset(token) OK")
        except ValueError as exc:
            print(f"  [consumer] ✗ reset(token) failed: {exc}")


async def main_consumer_raises():
    """
    Prove: consumer (evaluator) sets context, then async for over generator that raises.
    Consumer's finally runs when exception propagates. Is token still valid?
    """
    print("--- Consumer sets context, async for over generator that raises ---")
    print(f"Before: {cv.get()}")
    try:
        await consumer_with_context()
    except RuntimeError as e:
        print(f"  Caught: {e}")
    print(f"After: {cv.get()}")


async def gen_yield_sleep_raise():
    """Yields, then sleep(0), then raises — more context switches before raise."""
    yield 1
    await asyncio.sleep(0)
    yield 2
    raise RuntimeError("client error after second chunk")


async def consumer_with_sleep():
    """Consumer sets context, async for over gen that yields twice then raises."""
    token = cv.set("evaluator_span")
    try:
        async for chunk in gen_yield_sleep_raise():
            await asyncio.sleep(0)  # force context switch in consumer too
    finally:
        try:
            cv.reset(token)
            print("  [consumer] reset(token) OK")
        except ValueError as exc:
            print(f"  [consumer] ✗ reset(token) failed: {exc}")


async def main_consumer_with_sleep():
    print("--- Consumer sets context, async for (with sleep), generator raises ---")
    print(f"Before: {cv.get()}")
    try:
        await consumer_with_sleep()
    except RuntimeError as e:
        print(f"  Caught: {e}")
    print(f"After: {cv.get()}")


# ---- Empirical assertions (no pytest: asyncio + assert only) ----

_gen_reset_error: list[BaseException] = []
_gen_reset_ok_with_aclosing: list[bool] = []
_consumer_reset_ok: list[bool] = []
_gen_reset_ok_normal_exit: list[bool] = []
_chain_inner_reset_error: list[BaseException] = []


async def _gen_sets_token_consumer_raises():
    """Generator sets contextvar token, yields once; consumer will raise."""
    token = cv.set(3.14)
    try:
        yield 1
    finally:
        try:
            cv.reset(token)
        except ValueError as e:
            _gen_reset_error.append(e)


async def _gen_sets_token_consumer_raises_record_both():
    """Same as above but records both success and failure of reset (for aclosing)."""
    token = cv.set(3.14)
    try:
        yield 1
    finally:
        try:
            cv.reset(token)
            _gen_reset_ok_with_aclosing.append(True)
        except ValueError as e:
            _gen_reset_error.append(e)


async def _consumer_sets_token_gen_raises():
    """Consumer sets context, async for over generator that yields then raises."""
    token = cv.set("evaluator_span")
    try:
        async for _ in gen_that_yields_then_raises():
            pass
    finally:
        try:
            cv.reset(token)
            _consumer_reset_ok.append(True)
        except ValueError:
            _consumer_reset_ok.append(False)


async def _consumer_sets_token_gen_raises_with_sleep():
    token = cv.set("evaluator_span")
    try:
        async for _ in gen_yield_sleep_raise():
            await asyncio.sleep(0)
    finally:
        try:
            cv.reset(token)
            _consumer_reset_ok.append(True)
        except ValueError:
            _consumer_reset_ok.append(False)


async def _gen_sets_token_normal_exit():
    """Generator sets token, yields, exits normally (no consumer raise). Scenario 4."""
    token = cv.set(3.14)
    try:
        yield 1
        yield 2
    finally:
        try:
            cv.reset(token)
            _gen_reset_ok_normal_exit.append(True)
        except ValueError as e:
            _gen_reset_ok_normal_exit.append(False)
            _gen_reset_error.append(e)


async def _inner_b_chain():
    """Inner generator B: sets token, yields. Used inside outer A with aclosing(B)."""
    token = cv.set(3.14)
    try:
        yield 1
    finally:
        try:
            cv.reset(token)
        except ValueError as e:
            _chain_inner_reset_error.append(e)


async def _outer_a_chain():
    """
    Outer generator A (subscription): uses aclosing(inner B), yields B's chunks.
    No aclosing(A) at call site → when consumer raises, A is finalized → A.aclose()
    runs in finalizer task → B.aclose() runs there → B's finally in wrong context.
    """
    inner = _inner_b_chain()
    async with aclosing(inner) as stream:
        async for x in stream:
            yield x


async def run_empirical_tests():
    """
    Run all six scenarios and assert expected outcomes. Maps to analysis §4.1 (table)
    and §4.4 (chain of generators). No pytest: plain asyncio + assert to avoid confounders.
    """
    # 1. Generator sets token, consumer raises (no aclosing) -> generator's reset fails (§4.1 row 1)
    _gen_reset_error.clear()
    try:
        async for _ in _gen_sets_token_consumer_raises():
            raise RuntimeError("consumer raises")
    except RuntimeError:
        pass
    await asyncio.sleep(0)
    await asyncio.sleep(0)
    assert len(_gen_reset_error) == 1, f"expected 1 reset error, got {_gen_reset_error}"
    assert "different Context" in str(_gen_reset_error[0])

    # 2. Generator+aclosing, consumer raises -> generator's reset succeeds (§4.1 row 2)
    _gen_reset_error.clear()
    _gen_reset_ok_with_aclosing.clear()
    try:
        async with aclosing(_gen_sets_token_consumer_raises_record_both()) as agen:
            async for _ in agen:
                raise RuntimeError("consumer raises")
    except RuntimeError:
        pass
    await asyncio.sleep(0)
    assert _gen_reset_ok_with_aclosing == [True]
    assert len(_gen_reset_error) == 0

    # 3. Consumer sets token, generator raises -> consumer's reset succeeds (§4.1 row 3)
    _consumer_reset_ok.clear()
    try:
        await _consumer_sets_token_gen_raises()
    except RuntimeError:
        pass
    assert _consumer_reset_ok == [True]

    # 4. Same with sleep in loop -> consumer's reset still succeeds (§4.1 row 3 variant)
    _consumer_reset_ok.clear()
    try:
        await _consumer_sets_token_gen_raises_with_sleep()
    except RuntimeError:
        pass
    assert _consumer_reset_ok == [True]

    # 5. Normal exit (no exception) -> generator's reset succeeds (§4.1 scenario 4)
    _gen_reset_ok_normal_exit.clear()
    _gen_reset_error.clear()
    async for _ in _gen_sets_token_normal_exit():
        pass
    assert _gen_reset_ok_normal_exit == [True]
    assert len(_gen_reset_error) == 0

    # 6. Chain of generators (§4.4): outer A not closed by caller, A uses aclosing(B).
    #    Consumer raises -> A finalized -> A.aclose() in finalizer task -> B.aclose()
    #    there -> B's finally runs in wrong context -> B's reset fails.
    _chain_inner_reset_error.clear()
    try:
        async for _ in _outer_a_chain():
            raise RuntimeError("consumer raises")
    except RuntimeError:
        pass
    await asyncio.sleep(0)
    await asyncio.sleep(0)
    assert len(_chain_inner_reset_error) == 1
    assert "different Context" in str(_chain_inner_reset_error[0])


if __name__ == "__main__":
    asyncio.run(main())
    print()
    asyncio.run(main_normal())
    print()
    asyncio.run(main_consumer_raises())
    print()
    asyncio.run(main_consumer_with_sleep())
    print()
    print("--- Empirical assertions (no pytest) ---")
    asyncio.run(run_empirical_tests())
    print("All assertions passed.")
