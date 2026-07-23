"""Span analytics MCP tools: a typed, project-scoped query surface.

See :mod:`phoenix.server.mcp_span_analytics.tools` for the tool surface,
:mod:`phoenix.server.mcp_span_analytics.registry` for the field registry,
and :mod:`phoenix.server.mcp_span_analytics.compiler` for query
compilation.
"""

from phoenix.server.mcp_span_analytics.tools import build_span_analytics_tools

__all__ = ["build_span_analytics_tools"]
