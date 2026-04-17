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
