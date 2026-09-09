from typing import Optional

import strawberry
from strawberry import UNSET
from strawberry.relay import GlobalID


@strawberry.input(one_of=True)
class SpanIdentifierInput:
    id: Optional[GlobalID] = strawberry.field(
        default=UNSET, description="The span's Phoenix Relay node ID."
    )
    otel_id: Optional[str] = strawberry.field(
        default=UNSET, description="The span's OpenTelemetry span ID, matched exactly."
    )

    @property
    def reference(self) -> GlobalID | str:
        if isinstance(self.id, GlobalID):
            return self.id
        assert isinstance(self.otel_id, str)
        return self.otel_id


@strawberry.input(one_of=True)
class TraceIdentifierInput:
    id: Optional[GlobalID] = strawberry.field(
        default=UNSET, description="The trace's Phoenix Relay node ID."
    )
    otel_id: Optional[str] = strawberry.field(
        default=UNSET, description="The trace's OpenTelemetry trace ID, matched exactly."
    )

    @property
    def reference(self) -> GlobalID | str:
        if isinstance(self.id, GlobalID):
            return self.id
        assert isinstance(self.otel_id, str)
        return self.otel_id


@strawberry.input(one_of=True)
class ProjectSessionIdentifierInput:
    id: Optional[GlobalID] = strawberry.field(
        default=UNSET, description="The session's Phoenix Relay node ID."
    )
    session_id: Optional[str] = strawberry.field(
        default=UNSET,
        description="The raw session.id value supplied by the application, matched exactly.",
    )

    @property
    def reference(self) -> GlobalID | str:
        if isinstance(self.id, GlobalID):
            return self.id
        assert isinstance(self.session_id, str)
        return self.session_id
