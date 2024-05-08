import time
from threading import Thread

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
    labelnames=["core"],
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

        ram = psutil.virtual_memory()
        swap = psutil.swap_memory()

        RAM_METRIC.labels(type="virtual").set(ram.used)
        RAM_METRIC.labels(type="swap").set(swap.used)

        for core, percent in enumerate(psutil.cpu_percent(interval=1, percpu=True)):
            CPU_METRIC.labels(core=core).set(percent)
