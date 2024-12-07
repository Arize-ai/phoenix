import strawberry


@strawberry.type
class TokenUsage:
    prompt: int = 0
    completion: int = 0

    @strawberry.field
    async def total(self) -> int:
        return self.prompt + self.completion
