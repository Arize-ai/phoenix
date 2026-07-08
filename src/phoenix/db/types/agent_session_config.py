from typing import Literal

from pydantic import BaseModel


class AgentBuiltinProviderConfig(BaseModel):
    openai_api_type: Literal["chat_completions", "responses"] = "responses"
