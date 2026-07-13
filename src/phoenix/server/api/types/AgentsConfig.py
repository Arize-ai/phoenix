from typing import Optional

import strawberry


@strawberry.type
class AgentsConfig:
    collector_endpoint: Optional[str] = strawberry.field(
        description=(
            "The collector endpoint used by the server-side agents to export traces. "
            "Resolved from the PHOENIX_AGENTS_COLLECTOR_ENDPOINT environment variable."
        ),
    )
    assistant_project_name: str = strawberry.field(
        description=(
            "The project name used for assistant agent traces. "
            "Resolved from the PHOENIX_AGENTS_ASSISTANT_PROJECT_NAME environment variable."
        ),
    )
    force_tracing: bool = strawberry.field(
        description=(
            "Whether PXI tracing and remote export are forced for all users by the "
            "PHOENIX_AGENTS_FORCE_TRACING environment variable."
        ),
    )
    web_access_enabled: bool = strawberry.field(
        description=(
            "Whether PXI can expose native web search and web fetch capabilities. "
            "False when external resources are disabled or PHOENIX_AGENTS_DISABLE_WEB_ACCESS "
            "is true."
        ),
    )
    assistant_enabled: bool = strawberry.field(
        description=(
            "Admin ceiling for the agent assistant feature. Sourced from the "
            "`agent.assistant.enabled` system setting. When False, agent chat is "
            "disabled for the entire workspace regardless of individual user preferences."
        ),
    )
    allow_local_traces: bool = strawberry.field(
        description=(
            "Admin ceiling for persisting PXI traces in this Phoenix instance. "
            "Sourced from the `agent.assistant.trace_recording` system setting. When False, "
            "users cannot turn on local trace recording for themselves."
        ),
    )
    allow_remote_export: bool = strawberry.field(
        description=(
            "Admin ceiling for exporting PXI traces to the remote collector. "
            "Sourced from the `agent.assistant.trace_recording` system setting. When False, "
            "users cannot turn on remote trace export for themselves."
        ),
    )
