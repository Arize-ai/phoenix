"""Adjust a running replay's rate from a small HTTP control server and page.

The server also exposes its counts and settings at /metrics for Prometheus.
"""

from __future__ import annotations

import threading
import time
from collections import deque
from dataclasses import dataclass, replace
from typing import Any, Callable, Literal

Phase = Literal["seeding", "replaying"]

_MEASURED_RATE_WINDOW_SECONDS = 60.0
_MAX_SEND_BATCH = 1000


@dataclass(frozen=True)
class ReplaySettings:
    """Settings the replay loop reads before scheduling each trace."""

    rate: float
    burstiness: float
    paused: bool = False


class ReplayControl:
    """Thread-safe settings and delivery counts shared by the replay loop and the server.

    The loop waits on this object instead of sleeping, so a settings change or a send
    request wakes it immediately rather than after the current interarrival delay.
    """

    def __init__(
        self,
        settings: ReplaySettings,
        *,
        project_names: tuple[str, ...] = (),
        clock: Callable[[], float] = time.monotonic,
    ) -> None:
        _validate(settings)
        self._lock = threading.Lock()
        self._wake = threading.Event()
        self._clock = clock
        self._settings = settings
        self._version = 0
        self._pending_sends = 0
        self._phase: Phase = "seeding"
        self._sent = 0
        self._failed = 0
        self._recent: deque[float] = deque()
        self._project_names = project_names

    @property
    def version(self) -> int:
        """Incremented on every settings change, so the loop can tell its delay is stale."""
        with self._lock:
            return self._version

    def settings(self) -> ReplaySettings:
        with self._lock:
            return self._settings

    def update(
        self,
        *,
        rate: float | None = None,
        burstiness: float | None = None,
        paused: bool | None = None,
    ) -> ReplaySettings:
        """Apply a partial change, raising ValueError for an invalid one."""
        with self._lock:
            changes: dict[str, Any] = {}
            if rate is not None:
                changes["rate"] = float(rate)
            if burstiness is not None:
                changes["burstiness"] = float(burstiness)
            if paused is not None:
                changes["paused"] = bool(paused)
            settings = replace(self._settings, **changes)
            _validate(settings)
            if settings != self._settings:
                self._settings = settings
                self._version += 1
        self._wake.set()
        return settings

    def request_sends(self, count: int) -> None:
        """Ask the loop to send `count` traces now, outside the schedule."""
        if not 1 <= count <= _MAX_SEND_BATCH:
            raise ValueError(f"count must be between 1 and {_MAX_SEND_BATCH}")
        with self._lock:
            self._pending_sends += count
        self._wake.set()

    def take_pending_sends(self) -> int:
        with self._lock:
            count, self._pending_sends = self._pending_sends, 0
            return count

    def set_phase(self, phase: Phase) -> None:
        with self._lock:
            self._phase = phase

    def record_export(self, delivered: bool) -> None:
        now = self._clock()
        with self._lock:
            if delivered:
                self._sent += 1
                self._recent.append(now)
            else:
                self._failed += 1
            self._trim(now)

    def wait(self, timeout: float) -> bool:
        """Wait up to `timeout` seconds; return True if woken early by a change or request."""
        woken = self._wake.wait(timeout)
        self._wake.clear()
        return woken

    def snapshot(self) -> dict[str, Any]:
        now = self._clock()
        with self._lock:
            self._trim(now)
            return {
                "rate": self._settings.rate,
                "burstiness": self._settings.burstiness,
                "paused": self._settings.paused,
                "phase": self._phase,
                "sent": self._sent,
                "failed": self._failed,
                "measured_rate": len(self._recent) * 60.0 / _MEASURED_RATE_WINDOW_SECONDS,
                "pending_sends": self._pending_sends,
                "projects": list(self._project_names),
            }

    def _trim(self, now: float) -> None:
        while self._recent and now - self._recent[0] > _MEASURED_RATE_WINDOW_SECONDS:
            self._recent.popleft()


def render_metrics(snapshot: dict[str, Any]) -> str:
    """The snapshot in the Prometheus text exposition format.

    Counts are cumulative since the process started, so Prometheus derives rates from them.
    """
    metrics = [
        (
            "phoenix_datagen_traces_sent_total",
            "counter",
            "Traces the collector accepted",
            snapshot["sent"],
        ),
        (
            "phoenix_datagen_traces_failed_total",
            "counter",
            "Traces whose export failed, including those the collector rejected",
            snapshot["failed"],
        ),
        (
            "phoenix_datagen_rate_traces_per_minute",
            "gauge",
            "Configured mean traces per minute",
            snapshot["rate"],
        ),
        (
            "phoenix_datagen_burstiness",
            "gauge",
            "Configured interarrival variability; 0 is uniform",
            snapshot["burstiness"],
        ),
        ("phoenix_datagen_paused", "gauge", "1 while replay is paused", int(snapshot["paused"])),
        (
            "phoenix_datagen_seeding",
            "gauge",
            "1 while datasets are seeding, before replay starts",
            int(snapshot["phase"] == "seeding"),
        ),
    ]
    lines = []
    for name, kind, description, value in metrics:
        lines += [f"# HELP {name} {description}", f"# TYPE {name} {kind}", f"{name} {value}"]
    return "\n".join(lines) + "\n"


def _validate(settings: ReplaySettings) -> None:
    if not settings.rate > 0:
        raise ValueError("rate must be greater than zero")
    if settings.burstiness < 0:
        raise ValueError("burstiness must not be negative")


def create_control_app(control: ReplayControl) -> Any:
    """A Starlette app serving the control page and its JSON API."""
    from starlette.applications import Starlette
    from starlette.requests import Request
    from starlette.responses import HTMLResponse, JSONResponse, PlainTextResponse, Response
    from starlette.routing import Route

    from phoenix.experimental.datagen.control_page import CONTROL_PAGE

    async def page(_: Request) -> Response:
        return HTMLResponse(CONTROL_PAGE)

    async def get_state(_: Request) -> Response:
        return JSONResponse(control.snapshot())

    async def patch_state(request: Request) -> Response:
        try:
            body = await request.json()
        except ValueError:
            return JSONResponse({"error": "body must be JSON"}, status_code=400)
        if not isinstance(body, dict) or not body.keys() <= {"rate", "burstiness", "paused"}:
            return JSONResponse(
                {"error": "body may set only rate, burstiness, and paused"}, status_code=400
            )
        if "paused" in body and not isinstance(body["paused"], bool):
            return JSONResponse({"error": "paused must be a boolean"}, status_code=400)
        for name in ("rate", "burstiness"):
            value = body.get(name)
            if value is not None and (
                isinstance(value, bool) or not isinstance(value, (int, float))
            ):
                return JSONResponse({"error": f"{name} must be a number"}, status_code=400)
        try:
            control.update(**body)
        except ValueError as error:
            return JSONResponse({"error": str(error)}, status_code=400)
        return JSONResponse(control.snapshot())

    async def metrics(_: Request) -> Response:
        return PlainTextResponse(
            render_metrics(control.snapshot()), media_type="text/plain; version=0.0.4"
        )

    async def send(request: Request) -> Response:
        try:
            count = int(request.query_params.get("n", "1"))
            control.request_sends(count)
        except ValueError as error:
            return JSONResponse({"error": str(error)}, status_code=400)
        return JSONResponse(control.snapshot())

    return Starlette(
        routes=[
            Route("/", page),
            Route("/api/state", get_state, methods=["GET"]),
            Route("/api/state", patch_state, methods=["PATCH"]),
            Route("/api/send", send, methods=["POST"]),
            Route("/metrics", metrics, methods=["GET"]),
        ]
    )


def start_control_server(control: ReplayControl, *, host: str, port: int) -> threading.Thread:
    """Serve the control app from a daemon thread, so it ends with the replay."""
    import uvicorn

    server = uvicorn.Server(
        uvicorn.Config(create_control_app(control), host=host, port=port, log_level="warning")
    )
    thread = threading.Thread(target=server.run, name="datagen-control", daemon=True)
    thread.start()
    return thread
