import httpx

DEFAULT_TIMEOUT = httpx.Timeout(timeout=600.0, connect=5.0)
DEFAULT_MAX_RETRIES = 2
DEFAULT_CONNECTION_LIMITS = httpx.Limits(max_connections=1000, max_keepalive_connections=100)

ENV_OTEL_EXPORTER_OTLP_ENDPOINT = "OTEL_EXPORTER_OTLP_ENDPOINT"

# Phoenix environment variables
ENV_PHOENIX_PORT = "PHOENIX_PORT"
ENV_PHOENIX_GRPC_PORT = "PHOENIX_GRPC_PORT"
ENV_PHOENIX_HOST = "PHOENIX_HOST"
ENV_PHOENIX_HOST_ROOT_PATH = "PHOENIX_HOST_ROOT_PATH"
ENV_PHOENIX_COLLECTOR_ENDPOINT = "PHOENIX_COLLECTOR_ENDPOINT"
# Canonical base URL for API access. When it is unset the base URL is inferred
# from the trace-export variable above; the inference does not run the other
# way, so this variable alone never configures trace export.
ENV_PHOENIX_ENDPOINT = "PHOENIX_ENDPOINT"
# Undocumented compatibility fallback for the API base URL, honored *below*
# ENV_PHOENIX_COLLECTOR_ENDPOINT. This name appeared in the client docs for
# years but was never read by any code, so a value set from those docs silently
# did nothing; ranking it below the collector variable lets those
# configurations start working without retargeting anyone who set both. Do not
# document it or use it in new configuration.
ENV_PHOENIX_BASE_URL = "PHOENIX_BASE_URL"
ENV_PHOENIX_CLIENT_HEADERS = "PHOENIX_CLIENT_HEADERS"
ENV_PHOENIX_API_KEY = "PHOENIX_API_KEY"
# Canonical project-name variable, used in docs.
ENV_PHOENIX_PROJECT = "PHOENIX_PROJECT"
# Supported alias for ENV_PHOENIX_PROJECT (the name the Python SDKs historically
# read). ENV_PHOENIX_PROJECT takes precedence when both are set.
ENV_PHOENIX_PROJECT_NAME = "PHOENIX_PROJECT_NAME"
# Set to "false" (or "0" / "no" / "off") to disable .env.phoenix file discovery.
# Read from the process environment only.
ENV_PHOENIX_DISCOVER_CONFIG = "PHOENIX_DISCOVER_CONFIG"

# Name of the credential hand-off file discovered at (or above) the working directory.
PHOENIX_ENV_FILE_NAME = ".env.phoenix"

HOST = "0.0.0.0"
PORT = 6006
