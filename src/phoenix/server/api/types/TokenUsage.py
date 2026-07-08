import strawberry


@strawberry.type
class TokenUsage:
    prompt: float = 0
    completion: float = 0

    @strawberry.field
    async def total(self) -> float:
        return self.prompt + self.completion
