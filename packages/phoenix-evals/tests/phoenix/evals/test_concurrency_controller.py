import asyncio
from typing import Final

import pytest

from phoenix.evals.executors import ConcurrencyController


@pytest.mark.asyncio
async def test_aimd_increase_on_clean_window() -> None:
    max_c: Final[int] = 5
    controller = ConcurrencyController(
        max_concurrency=max_c,
        initial_target=1,
        window_seconds=0.1,
        increase_step=1,
        decrease_ratio=0.5,
        inactive_check_interval=0.01,
        smoothing_factor=0.2,
    )

    controller.record_success(0.01)
    controller.record_success(0.02)
    await asyncio.sleep(0.02)

    await asyncio.sleep(0.12)
    controller.record_success(0.02)
    await asyncio.sleep(0.02)

    assert controller.target_concurrency == 2


@pytest.mark.asyncio
async def test_aimd_decrease_on_error_window() -> None:
    controller = ConcurrencyController(
        max_concurrency=10,
        initial_target=4,
        window_seconds=0.1,
        increase_step=1,
        decrease_ratio=0.5,
        inactive_check_interval=0.01,
        smoothing_factor=0.2,
    )

    controller.record_timeout()
    await asyncio.sleep(0.02)

    await asyncio.sleep(0.12)
    controller.record_success(0.02)
    await asyncio.sleep(0.02)

    assert controller.target_concurrency == 2


@pytest.mark.asyncio
async def test_aimd_caps_at_max_concurrency() -> None:
    controller = ConcurrencyController(
        max_concurrency=3,
        initial_target=2,
        window_seconds=0.05,
        increase_step=2,
        decrease_ratio=0.5,
        inactive_check_interval=0.01,
        smoothing_factor=0.2,
    )

    controller.record_success(0.01)
    await asyncio.sleep(0.06)
    controller.record_success(0.02)
    await asyncio.sleep(0.02)

    assert controller.target_concurrency == 3


@pytest.mark.asyncio
async def test_aimd_no_change_before_window_end() -> None:
    controller = ConcurrencyController(
        max_concurrency=10,
        initial_target=3,
        window_seconds=0.5,
        increase_step=2,
        decrease_ratio=0.5,
        inactive_check_interval=0.01,
        smoothing_factor=0.2,
    )

    controller.record_success(0.01)
    await asyncio.sleep(0.1)
    # Still within the window; target should not change yet
    assert controller.target_concurrency == 3

    # Now let the window end and trigger an update
    await asyncio.sleep(0.45)
    controller.record_success(0.02)
    await asyncio.sleep(0.02)
    assert controller.target_concurrency == 5


@pytest.mark.asyncio
async def test_aimd_multiple_error_windows_fractional_then_floor_to_one() -> None:
    controller = ConcurrencyController(
        max_concurrency=10,
        initial_target=3,
        window_seconds=0.05,
        increase_step=1,
        decrease_ratio=0.5,
        inactive_check_interval=0.01,
        smoothing_factor=0.2,
    )

    # First error window → 3 * 0.5 = 1.5
    controller.record_error()
    await asyncio.sleep(0.06)
    controller.record_success(0.02)
    await asyncio.sleep(0.02)
    # Raw target retains fractional value internally
    assert abs(controller._target_concurrency - 1.5) < 1e-9  # type: ignore[attr-defined]
    # Applied target used by consumers is floored to 1 and clamped within bounds
    assert controller.target_concurrency == 1

    # Second error window → 1.5 * 0.5 = 0.75 ⇒ clamped to 1.0
    controller.record_error()
    await asyncio.sleep(0.06)
    controller.record_success(0.02)
    await asyncio.sleep(0.02)
    assert controller.target_concurrency == 1


@pytest.mark.asyncio
async def test_collapse_on_burst_errors_within_window() -> None:
    controller = ConcurrencyController(
        max_concurrency=10,
        initial_target=6,
        window_seconds=1.0,
        increase_step=1,
        decrease_ratio=0.5,
        inactive_check_interval=0.01,
        smoothing_factor=0.2,
        collapse_window_seconds=0.2,
        collapse_error_threshold=2,
    )

    # Two errors quickly within collapse window should immediately set target to 1.0
    controller.record_error()
    controller.record_error()
    # No need to wait for window end; collapse is immediate on threshold
    assert controller.target_concurrency == 1
