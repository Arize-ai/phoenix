"""Startup banner for `phoenix serve`."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional
from urllib.parse import urlsplit, urlunsplit

from jinja2 import BaseLoader, Environment

from phoenix.utilities import no_emojis_on_windows, stdout_supports_unicode

_GITHUB_URL = "https://github.com/Arize-ai/phoenix"
_SLACK_URL = "https://join.slack.com/t/arize-ai/shared_invite/zt-3r07iavnk-ammtATWSlF0pSrd1DsMW7g"
_DOCS_URL = "https://arize.com/docs/phoenix"

_BOOT_MESSAGE = Environment(
    loader=BaseLoader(),
    autoescape=False,
    trim_blocks=True,
    lstrip_blocks=True,
).from_string(
    """
{% macro header(icon, title, heavy=false) -%}
{% set character = heavy_rule if heavy else rule -%}
{% set prefix = character * 2 ~ " " ~ ((icon ~ " ") if unicode_ok else "") ~ title ~ " " -%}
{{ prefix }}{{ character * (68 - prefix | length) }}
{%- endmacro %}
{% if unicode_ok %}
██████╗ ██╗  ██╗ ██████╗ ███████╗███╗   ██╗██╗██╗  ██╗
██╔══██╗██║  ██║██╔═══██╗██╔════╝████╗  ██║██║╚██╗██╔╝
██████╔╝███████║██║   ██║█████╗  ██╔██╗ ██║██║ ╚███╔╝
██╔═══╝ ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║██║ ██╔██╗
██║     ██║  ██║╚██████╔╝███████╗██║ ╚████║██║██╔╝ ██╗
╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝╚═╝╚═╝  ╚═╝

{% endif %}
Arize Phoenix v{{ version }} {{ "·" if unicode_ok else "-" }} AI Observability & Evaluation

{{ header("💾", "Storage") }}
  Database            {{ database }}
{% if database_schema %}
  Schema              {{ database_schema }}
{% endif %}
{% if read_replica %}
  Read replica        {{ read_replica }}
{% endif %}
{% if storage_capacity_gibibytes is not none %}
  Capacity limit      {{ "%g" | format(storage_capacity_gibibytes) }} GiB
{% endif %}
{% if retention_policy_days > 0 %}
  Default retention   {{ retention_policy_days }} days
{% endif %}

{{ header("🔐", "Auth & Security") }}
  Authentication      {{ enabled if auth_enabled else disabled }}
{% if auth_enabled and basic_auth_disabled %}
  Basic auth          {{ disabled }}
{% endif %}
{% if oauth2_idp_names %}
  OAuth2 providers    {{ oauth2_idp_names | join(", ") }}
{% endif %}
{% if ldap_enabled %}
  LDAP                {{ enabled }}
{% endif %}
  TLS (HTTP)          {{ enabled if tls_enabled_for_http else disabled }}
  TLS (gRPC)          {{ enabled if tls_enabled_for_grpc else disabled }}
{% if tls_verify_client %}
  mTLS client verify  {{ enabled }}
{% endif %}
{% if allowed_origins %}
  Allowed origins     {{ allowed_origins | join(", ") }}
{% endif %}

{{ header("🧩", "Features") }}
{% if enabled_sandboxes %}
  Code sandboxes      {{ enabled_marker }}{{ enabled_sandboxes | join(", ") }}
{% endif %}
{% if disabled_sandboxes %}
  {{ disabled_sandbox_prefix }}{{ disabled_marker }}{{ disabled_sandboxes | join(", ") }}
{% endif %}
  Prometheus metrics  {{ enabled if prometheus_enabled else disabled }}
  Email (SMTP)        {{ smtp_hostname or not_configured }}
  Telemetry           {{ enabled if telemetry_enabled else disabled }}

{% if assistant_config %}
{{ header("✨", "Assistant") }}
  Agent assistant     {{ enabled if agent_assistant_enabled else disabled }}
  Trace project       {{ assistant_config.project_name or not_configured }}
  Local traces        {{ enabled if assistant_config.allow_local_traces else disabled }}
  Remote export       {{ enabled if assistant_config.allow_remote_export else disabled }}
  Remote collector    {{ assistant_config.printable_collector_endpoint or not_configured }}
{% set collector_api_key = configured if assistant_config.api_key_configured else not_configured %}
  Collector API key   {{ collector_api_key }}
  Force tracing       {{ enabled if assistant_config.force_tracing else disabled }}
  Web access          {{ enabled if assistant_config.web_access_enabled else disabled }}
  Server-side bash    {{ enabled if assistant_config.server_bash_enabled else disabled }}
  GitHub tools        {{ enabled if assistant_config.github_enabled else disabled }}

{% endif %}
{% if dev_mode or debug_logging or dev_vite_url or debugpy_url %}
{{ header("🐛", "Development") }}
{% if dev_mode %}
  Dev mode            {{ enabled }}
{% endif %}
{% if debug_logging %}
  Debug logging       {{ enabled }}
{% endif %}
{% if dev_vite_url %}
  Vite dev server     {{ dev_vite_url }}
{% endif %}
{% if debugpy_url %}
  debugpy             {{ debugpy_url }}
{% endif %}

{% endif %}
{{ header("🌎", "Community") }}
  Star on GitHub      {{ github_url }}
  Community Slack     {{ slack_url }}
  Documentation       {{ docs_url }}
  Docs MCP            {{ docs_mcp_url or disabled }}

{{ header("🌐", "Server") }}
  Web UI              {{ ui_url }}
  REST API            {{ rest_api_url }}
  GraphQL API         {{ graphql_url }}
  MCP server          {{ mcp_url or disabled }}
{% if read_only %}
  Mode                Read-only
{% endif %}

{{ header("📡", "Tracing " ~ dash ~ " send traces here", heavy=true) }}
  {{ arrow }} OTLP over gRPC    {{ otlp_grpc_url }}
  {{ arrow }} OTLP over HTTP    {{ otlp_http_url }}

{{ rocket }}Phoenix is up and running {{ dash }} open {{ ui_url }} to get started.
"""
)


def _hide_url_password(url: Optional[str]) -> Optional[str]:
    """Mask a password embedded in a URL's userinfo so it never reaches stdout.

    Mirrors how the banner prints the database URL, which goes through
    SQLAlchemy's `render_as_string(hide_password=True)`.
    """
    if not url:
        return url
    parsed = urlsplit(url)
    userinfo, separator, host = parsed.netloc.rpartition("@")
    if not separator:
        return url
    username, has_password, _ = userinfo.partition(":")
    redacted = f"{username}:***@{host}" if has_password else f"{username}@{host}"
    return urlunsplit(parsed._replace(netloc=redacted))


@dataclass(frozen=True)
class AssistantConfig:
    """Effective server-side assistant configuration displayed at startup."""

    project_name: str
    allow_local_traces: bool
    allow_remote_export: bool
    collector_endpoint: Optional[str]
    api_key_configured: bool
    force_tracing: bool
    web_access_enabled: bool
    server_bash_enabled: bool
    github_enabled: bool

    @property
    def printable_collector_endpoint(self) -> Optional[str]:
        """The collector endpoint with any embedded password masked."""
        return _hide_url_password(self.collector_endpoint)


@dataclass(frozen=True)
class BootMessage:
    """Effective server configuration displayed when `phoenix serve` starts."""

    version: str
    ui_url: str
    rest_api_url: str
    graphql_url: str
    mcp_url: Optional[str]
    read_only: bool
    otlp_grpc_url: str
    otlp_http_url: str
    database: str
    database_schema: Optional[str]
    read_replica: Optional[str]
    storage_capacity_gibibytes: Optional[float]
    retention_policy_days: int
    auth_enabled: bool
    basic_auth_disabled: bool
    oauth2_idp_names: list[str]
    ldap_enabled: bool
    tls_enabled_for_http: bool
    tls_enabled_for_grpc: bool
    tls_verify_client: bool
    allowed_origins: Optional[list[str]]
    sandbox_providers: list[tuple[str, bool]]
    agent_assistant_enabled: bool
    docs_mcp_url: Optional[str]
    prometheus_enabled: bool
    smtp_hostname: str
    telemetry_enabled: bool
    # Depends on database-backed system settings, so it is only known once the
    # server has started. `phoenix serve` fills it in at render time; until then
    # the banner omits the Assistant section entirely.
    assistant_config: Optional[AssistantConfig] = None
    dev_mode: bool = False
    debug_logging: bool = False
    dev_vite_url: Optional[str] = None
    debugpy_url: Optional[str] = None

    def render(self, unicode_ok: Optional[bool] = None) -> str:
        """Render the startup banner for the active console."""
        if unicode_ok is None:
            unicode_ok = stdout_supports_unicode()
        enabled_sandboxes = [name for name, enabled in self.sandbox_providers if enabled]
        disabled_sandboxes = [name for name, enabled in self.sandbox_providers if not enabled]
        return no_emojis_on_windows(
            _BOOT_MESSAGE.render(
                **vars(self),
                unicode_ok=unicode_ok,
                rule="─" if unicode_ok else "-",
                heavy_rule="━" if unicode_ok else "=",
                arrow="▶" if unicode_ok else ">",
                dash="—" if unicode_ok else "-",
                enabled="✅ Enabled" if unicode_ok else "Enabled",
                disabled="➖ Disabled" if unicode_ok else "Disabled",
                not_configured="➖ Not configured" if unicode_ok else "Not configured",
                configured="✅ Configured" if unicode_ok else "Configured",
                enabled_marker="✅ " if unicode_ok else "Enabled: ",
                disabled_marker="➖ " if unicode_ok else "Disabled: ",
                enabled_sandboxes=enabled_sandboxes,
                disabled_sandboxes=disabled_sandboxes,
                disabled_sandbox_prefix=(" " * 20 if enabled_sandboxes else "Code sandboxes      "),
                rocket="🚀 " if unicode_ok else "",
                github_url=_GITHUB_URL,
                slack_url=_SLACK_URL,
                docs_url=_DOCS_URL,
            )
        )
