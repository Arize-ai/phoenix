from typing import List, Literal

from pydantic import BaseModel

Role = Literal["system", "assistant", "user"]


class Message(BaseModel):
    role: Role
    content: str


class MessagesPayload(BaseModel):
    messages: List[Message]


class MessagesResponse(BaseModel):
    message: Message
