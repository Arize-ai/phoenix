"""Startup banner for `phoenix serve`.

Everything the server discloses at boot lives here: :class:`BootMessage` is a
frozen snapshot of the effective configuration (one field per reported fact),
and :meth:`BootMessage.render` turns it into the banner text. Auditing what the
server prints on startup means reading this one module — the CLI only gathers
values.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from phoenix.utilities import stdout_supports_unicode

_MESSAGE_WIDTH = 68
_LABEL_WIDTH = 20

# Joined line by line (rather than one triple-quoted block) so the padding that
# keeps every row the same width survives trailing-whitespace lint (W291).
_UNICODE_LOGO = "\n".join(
    (
        "██████╗ ██╗  ██╗ ██████╗ ███████╗███╗   ██╗██╗██╗  ██╗",
        "██╔══██╗██║  ██║██╔═══██╗██╔════╝████╗  ██║██║╚██╗██╔╝",
        "██████╔╝███████║██║   ██║█████╗  ██╔██╗ ██║██║ ╚███╔╝ ",
        "██╔═══╝ ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║██║ ██╔██╗ ",
        "██║     ██║  ██║╚██████╔╝███████╗██║ ╚████║██║██╔╝ ██╗",
        "╚═╝     ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝╚═╝╚═╝  ╚═╝",
    )
)

_GITHUB_URL = "https://github.com/Arize-ai/phoenix"
_SLACK_URL = "https://join.slack.com/t/arize-ai/shared_invite/zt-3r07iavnk-ammtATWSlF0pSrd1DsMW7g"
_DOCS_URL = "https://arize.com/docs/phoenix"


@dataclass(frozen=True)
class BootMessage:
    """Everything the `phoenix serve` startup banner reports.

    Each field corresponds to one line (or one optional line) of the banner,
    grouped below in the order the sections are rendered.
    """

    version: str

    # ── Server ───────────────────────────────────────────────────────────
    ui_url: str
    rest_api_url: str
    graphql_url: str
    mcp_url: Optional[str]  # None when the MCP server is disabled
    read_only: bool

    # ── Tracing (highlighted) ────────────────────────────────────────────
    otlp_grpc_url: str
    otlp_http_url: str

    # ── Storage ──────────────────────────────────────────────────────────
    database: str
    database_schema: Optional[str]
    read_replica: Optional[str]
    storage_capacity_gibibytes: Optional[float]
    retention_policy_days: int

    # ── Auth & security ──────────────────────────────────────────────────
    auth_enabled: bool
    basic_auth_disabled: bool
    oauth2_idp_names: list[str]
    ldap_enabled: bool
    tls_enabled_for_http: bool
    tls_enabled_for_grpc: bool
    tls_verify_client: bool
    allowed_origins: Optional[list[str]]

    # ── Features ─────────────────────────────────────────────────────────
    sandbox_providers: list[tuple[str, bool]]  # (provider name, enabled)
    agent_assistant_enabled: bool
    docs_mcp_url: Optional[str]  # None when the docs MCP connection is disabled
    prometheus_enabled: bool
    smtp_hostname: str  # empty string when email is not configured
    telemetry_enabled: bool

    def render(self, unicode_ok: Optional[bool] = None) -> str:
        if unicode_ok is None:
            unicode_ok = stdout_supports_unicode()
        rule = "─" if unicode_ok else "-"
        heavy_rule = "━" if unicode_ok else "="
        arrow = "▶" if unicode_ok else ">"
        on = "✅ Enabled" if unicode_ok else "Enabled"
        off = "➖ Disabled" if unicode_ok else "Disabled"

        def status(enabled: bool) -> str:
            return on if enabled else off

        def emoji(icon: str, title: str) -> str:
            return f"{icon} {title}" if unicode_ok else title

        def section(
            title: str,
            rows: list[tuple[str, str]],
            rule_char: str = rule,
        ) -> list[str]:
            header = f"{rule_char * 2} {title} "
            lines = [header + rule_char * max(0, _MESSAGE_WIDTH - len(header))]
            lines.extend(f"  {label:<{_LABEL_WIDTH}}{value}".rstrip() for label, value in rows)
            lines.append("")
            return lines

        server_rows: list[tuple[str, str]] = [
            ("Web UI", self.ui_url),
            ("REST API", self.rest_api_url),
            ("GraphQL API", self.graphql_url),
            ("MCP server", self.mcp_url or off),
        ]
        if self.read_only:
            server_rows.append(("Mode", "Read-only"))

        # Rendered with heavy rules and arrow markers so the endpoints to send
        # traces to stand out from every other section.
        tracing_rows: list[tuple[str, str]] = [
            (f"{arrow} OTLP over gRPC", self.otlp_grpc_url),
            (f"{arrow} OTLP over HTTP", self.otlp_http_url),
        ]

        storage_rows: list[tuple[str, str]] = [("Database", self.database)]
        if self.database_schema:
            storage_rows.append(("Schema", self.database_schema))
        if self.read_replica:
            storage_rows.append(("Read replica", self.read_replica))
        if self.storage_capacity_gibibytes is not None:
            storage_rows.append(("Capacity limit", f"{self.storage_capacity_gibibytes:g} GiB"))
        if self.retention_policy_days > 0:
            storage_rows.append(("Default retention", f"{self.retention_policy_days} days"))

        security_rows: list[tuple[str, str]] = [("Authentication", status(self.auth_enabled))]
        if self.auth_enabled and self.basic_auth_disabled:
            security_rows.append(("Basic auth", status(False)))
        if self.oauth2_idp_names:
            security_rows.append(("OAuth2 providers", ", ".join(self.oauth2_idp_names)))
        if self.ldap_enabled:
            security_rows.append(("LDAP", status(True)))
        security_rows.append(("TLS (HTTP)", status(self.tls_enabled_for_http)))
        security_rows.append(("TLS (gRPC)", status(self.tls_enabled_for_grpc)))
        if self.tls_verify_client:
            security_rows.append(("mTLS client verify", status(True)))
        if self.allowed_origins:
            security_rows.append(("Allowed origins", ", ".join(self.allowed_origins)))

        enabled_sandboxes = [name for name, enabled in self.sandbox_providers if enabled]
        disabled_sandboxes = [name for name, enabled in self.sandbox_providers if not enabled]
        feature_rows: list[tuple[str, str]] = []
        if enabled_sandboxes:
            marker = "✅ " if unicode_ok else "Enabled: "
            feature_rows.append(("Code sandboxes", marker + ", ".join(enabled_sandboxes)))
        if disabled_sandboxes:
            marker = "➖ " if unicode_ok else "Disabled: "
            label = "Code sandboxes" if not enabled_sandboxes else ""
            feature_rows.append((label, marker + ", ".join(disabled_sandboxes)))
        feature_rows.append(("Agent assistant", status(self.agent_assistant_enabled)))
        feature_rows.append(("Prometheus metrics", status(self.prometheus_enabled)))
        not_configured = "➖ Not configured" if unicode_ok else "Not configured"
        feature_rows.append(("Email (SMTP)", self.smtp_hostname or not_configured))
        feature_rows.append(("Telemetry", status(self.telemetry_enabled)))

        # Plain labels here: emoji are double-width in most terminals and would
        # knock these rows' value column out of alignment with the rest.
        community_rows: list[tuple[str, str]] = [
            ("Star on GitHub", _GITHUB_URL),
            ("Community Slack", _SLACK_URL),
            ("Documentation", _DOCS_URL),
            ("Docs MCP", self.docs_mcp_url or off),
        ]

        lines: list[str] = [""]
        if unicode_ok:
            lines.extend((_UNICODE_LOGO, ""))
        separator = "·" if unicode_ok else "-"
        lines.append(f"Arize Phoenix v{self.version} {separator} AI Observability & Evaluation")
        lines.append("")
        dash = "—" if unicode_ok else "-"
        lines.extend(section(emoji("🌐", "Server"), server_rows))
        lines.extend(
            section(
                emoji("📡", f"Tracing {dash} send traces here"),
                tracing_rows,
                rule_char=heavy_rule,
            )
        )
        lines.extend(section(emoji("💾", "Storage"), storage_rows))
        lines.extend(section(emoji("🔐", "Auth & Security"), security_rows))
        lines.extend(section(emoji("🧩", "Features"), feature_rows))
        lines.extend(section(emoji("🌎", "Community"), community_rows))
        lines.append(
            f"{emoji('🚀', 'Phoenix')} is up and running {dash} open {self.ui_url} to get started."
        )
        lines.append("")
        return "\n".join(lines)
