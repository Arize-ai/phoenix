import strawberry

from phoenix.server.api.types.MimeType import MimeType


@strawberry.type
class SpanIOValue:
    mime_type: MimeType
    value: str

    @strawberry.field(
        description="Truncate value up to `chars` characters, appending '...' if truncated.",
    )  # type: ignore
    def truncated_value(self, chars: int = 100) -> str:
        return f"{self.value[: max(0, chars - 3)]}..." if len(self.value) > chars else self.value
