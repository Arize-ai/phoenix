"""Span analytics MCP tools: a typed, project-scoped query surface.

See :mod:`phoenix.server.mcp_span_analytics.tools` for the tool surface,
:mod:`phoenix.server.mcp_span_analytics.registry` for the field registry,
:mod:`phoenix.server.mcp_span_analytics.compiler` for query compilation,
:mod:`phoenix.server.mcp_span_analytics.discovery` for observed-path
sampling, :mod:`phoenix.server.mcp_span_analytics.envelope` for response
envelopes and size budgeting, and
:mod:`phoenix.server.mcp_span_analytics.links` for UI link composition.
"""

from phoenix.server.mcp_span_analytics.tools import build_span_analytics_tools

__all__ = ["build_span_analytics_tools"]
