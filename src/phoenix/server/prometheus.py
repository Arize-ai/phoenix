import os
import sys
import time
from functools import lru_cache
from threading import Thread
from typing import Optional

import psutil
from prometheus_client import (
    Counter,
    Gauge,
    Summary,
    start_http_server,
)
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.requests import Request
from starlette.responses import Response
from starlette.routing import Match

REQUESTS_PROCESSING_TIME = Summary(
    name="starlette_requests_processing_time_seconds_summary",
    documentation="Summary of requests processing time by method and path (in seconds)",
    labelnames=["method", "path"],
)
EXCEPTIONS = Counter(
    name="starlette_exceptions_total",
    documentation="Total count of exceptions raised by method, path and exception type",
    labelnames=["method", "path", "exception_type"],
)
RAM_METRIC = Gauge(
    name="memory_usage_bytes",
    documentation="Memory usage in bytes",
    labelnames=["type"],
)
CPU_METRIC = Gauge(
    name="cpu_usage_percent",
    documentation="CPU usage percent",
)
BULK_LOADER_INSERTION_TIME = Summary(
    name="bulk_loader_insertion_time_seconds_summary",
    documentation="Summary of database insertion time (seconds)",
)
BULK_LOADER_SPAN_INSERTIONS = Counter(
    name="bulk_loader_span_insertions_total",
    documentation="Total count of bulk loader span insertions",
)
BULK_LOADER_EVALUATION_INSERTIONS = Counter(
    name="bulk_loader_evaluation_insertions_total",
    documentation="Total count of bulk loader evaluation insertions",
)
BULK_LOADER_EXCEPTIONS = Counter(
    name="bulk_loader_exceptions_total",
    documentation="Total count of bulk loader exceptions",
)

RATE_LIMITER_CACHE_SIZE = Gauge(
    name="rate_limiter_cache_size",
    documentation="Current size of the rate limiter cache",
)

RATE_LIMITER_THROTTLES = Counter(
    name="rate_limiter_throttles_total",
    documentation="Total count of rate limiter throttles",
)

JWT_STORE_TOKENS_ACTIVE = Gauge(
    name="jwt_store_tokens_active",
    documentation="Current number of refresh tokens in the JWT store",
)

JWT_STORE_API_KEYS_ACTIVE = Gauge(
    name="jwt_store_api_keys_active",
    documentation="Current number of API keys in the JWT store",
)


class PrometheusMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        for route in request.app.routes:
            match, _ = route.matches(request.scope)
            if match is Match.FULL:
                path = route.path
                break
        else:
            return await call_next(request)
        method = request.method
        start_time = time.perf_counter()
        try:
            response = await call_next(request)
        except BaseException as e:
            EXCEPTIONS.labels(method=method, path=path, exception_type=type(e).__name__).inc()
            raise
        end_time = time.perf_counter()
        REQUESTS_PROCESSING_TIME.labels(method=method, path=path).observe(end_time - start_time)
        return response


def start_prometheus() -> None:
    Thread(target=gather_system_data, daemon=True).start()
    start_http_server(9090, addr="::")


def gather_system_data() -> None:
    while True:
        time.sleep(1)

        RAM_METRIC.labels(type="virtual").set(estimate_memory_usage_bytes())
        RAM_METRIC.labels(type="swap").set(estimate_swap_usage_bytes())
        if cpu_metric := estimate_cpu_usage_percent():
            CPU_METRIC.set(cpu_metric)


def estimate_memory_usage_bytes() -> int:
    # https://docs.docker.com/engine/containers/runmetrics/
    # psutil reports host-level metrics, use cgroups if running on linux

    if sys.platform == "linux":
        cgroup_v1_file = "/sys/fs/cgroup/memory/memory.usage_in_bytes"
        cgroup_v2_file = "/sys/fs/cgroup/memory.current"

        if is_cgroup_v2():
            try:
                with open(cgroup_v2_file, "r") as f:
                    return int(f.read().strip())
            except Exception:
                pass
        else:
            try:
                with open(cgroup_v1_file, "r") as f:
                    return int(f.read().strip())
            except Exception:
                pass
    return psutil.virtual_memory().used


def estimate_swap_usage_bytes() -> int:
    if sys.platform == "linux":
        # cgroup v2: swap usage file (if swap accounting is enabled).
        cgroup_v2_swap_file = "/sys/fs/cgroup/memory.swap.current"
        cgroup_v1_swap_file = "/sys/fs/cgroup/memory/memory.memsw.usage_in_bytes"

        if is_cgroup_v2() and os.path.exists(cgroup_v2_swap_file):
            try:
                with open(cgroup_v2_swap_file, "r") as f:
                    return int(f.read().strip())
            except Exception:
                pass
        elif os.path.exists(cgroup_v1_swap_file):
            try:
                with open(cgroup_v1_swap_file, "r") as f:
                    return int(f.read().strip())
            except Exception:
                pass
    return psutil.swap_memory().used


_previous_cpu_sample: dict[str, tuple[float, float]] = {}  # cache for previous cpu usage sample


def estimate_cpu_usage_percent() -> Optional[float]:
    # https://docs.docker.com/engine/containers/runmetrics/
    # psutil reports host-level metrics, use cgroups if running on linux

    current_time = time.time()

    if sys.platform.startswith("linux"):
        cgroup_v2_cpu_stat = "/sys/fs/cgroup/cpu.stat"
        cgroup_v1_cpu_usage = "/sys/fs/cgroup/cpuacct/cpuacct.usage"
        if is_cgroup_v2():
            try:
                with open(cgroup_v2_cpu_stat, "r") as f:
                    lines = f.readlines()
                stats = {}
                for line in lines:
                    parts = line.strip().split()
                    if len(parts) == 2:
                        stats[parts[0]] = float(parts[1])
                if "usage_usec" in stats:
                    usage = stats["usage_usec"]
                    key = "cgroup_v2"
                    if key in _previous_cpu_sample:
                        prev_usage, prev_time = _previous_cpu_sample[key]
                        delta_usage = usage - prev_usage  # in microseconds
                        delta_time = current_time - prev_time
                        _previous_cpu_sample[key] = (usage, current_time)
                        if delta_time > 0:
                            # Convert microseconds to seconds.
                            return round((delta_usage / (delta_time * 1e6)) * 100, 2)
                    else:
                        _previous_cpu_sample[key] = (usage, current_time)
                        return None  # No previous sample yet.
            except Exception:
                pass
        else:
            try:
                with open(cgroup_v1_cpu_usage, "r") as f:
                    usage = int(f.read().strip())
                key = "cgroup_v1"
                if key in _previous_cpu_sample:
                    prev_usage, prev_time = _previous_cpu_sample[key]
                    delta_usage = usage - prev_usage  # in nanoseconds
                    delta_time = current_time - prev_time
                    _previous_cpu_sample[key] = (usage, current_time)
                    if delta_time > 0:
                        # Convert nanoseconds to seconds.
                        return round((delta_usage / (delta_time * 1e9)) * 100, 2)
                else:
                    _previous_cpu_sample[key] = (usage, current_time)
                    return None  # No previous sample yet.
            except Exception:
                pass
        return psutil.cpu_percent(interval=None)


@lru_cache(maxsize=1)
def is_cgroup_v2() -> bool:
    return os.path.exists("/sys/fs/cgroup/cgroup.controllers")
