"""Agent-domain helpers for Phoenix chat orchestration.

Package layout
--------------
``chat_params``
    Pydantic schemas for the discriminated chat-request payload (built-in
    versus custom provider).
``context``
    UI-context resolution and sanitization. Builds the per-turn
    ``<phoenix_ui_context>`` user message and exposes ``ToolExecutionEnv``
    and ``ResolvedContexts`` consumed by tool builders.
``model_factory``
    Constructs ``pydantic_ai.Model`` instances for both built-in providers
    (with secret-store / env credentials) and custom provider records.
    Transport-neutral; raises ``AgentError`` subclasses on failure.
``exceptions``
    Domain exception hierarchy (``AgentError`` and provider-specific
    subclasses). Each carries a ``status_code`` so the REST router can
    translate them to HTTP responses without inspecting types.
``mcp``
    Mintlify-hosted MCP backend tool client. Lazily connected and shared
    across requests via ``app.state``.
``tools``
    PXI tool resolution. ``resolve_tools`` returns the server-defined tools
    advertised for a turn, including always-available external tools and
    UI-context-gated contextual tools. Server-executed contextual tools also
    contribute dispatch callables for the data-stream protocol.

The ``/chat`` router (``phoenix.server.api.routers.chat``) is the only
intended caller; treat anything not re-exported here as internal.
"""
