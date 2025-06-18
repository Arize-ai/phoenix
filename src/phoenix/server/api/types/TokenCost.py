from typing import Optional

import strawberry


@strawberry.type
class TokenCost:
    input: Optional[float] = None
    output: Optional[float] = None
    prompt: Optional[float] = None
    completion: Optional[float] = None
    cache_read: Optional[float] = None
    cache_write: Optional[float] = None
    prompt_audio: Optional[float] = None
    completion_audio: Optional[float] = None
    reasoning: Optional[float] = None
    total: Optional[float] = None

    def __add__(self, other: "TokenCost") -> "TokenCost":
        return TokenCost(
            input=self._add_optional(self.input, other.input),
            output=self._add_optional(self.output, other.output),
            prompt=self._add_optional(self.prompt, other.prompt),
            completion=self._add_optional(self.completion, other.completion),
            cache_read=self._add_optional(self.cache_read, other.cache_read),
            cache_write=self._add_optional(self.cache_write, other.cache_write),
            prompt_audio=self._add_optional(self.prompt_audio, other.prompt_audio),
            completion_audio=self._add_optional(self.completion_audio, other.completion_audio),
            reasoning=self._add_optional(self.reasoning, other.reasoning),
            total=self._add_optional(self.total, other.total),
        )

    @staticmethod
    def _add_optional(a: Optional[float], b: Optional[float]) -> Optional[float]:
        if a is None and b is None:
            return None
        return (a or 0.0) + (b or 0.0)

    def __bool__(self) -> bool:
        return any(
            value is not None and value > 0
            for value in [
                self.input,
                self.output,
                self.prompt,
                self.completion,
                self.cache_read,
                self.cache_write,
                self.prompt_audio,
                self.completion_audio,
                self.reasoning,
                self.total,
            ]
        )
