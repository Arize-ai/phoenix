from typing import List, Literal, Optional

from pydantic import BaseModel

Role = Literal["system", "assistant", "user"]


class Message(BaseModel):
    role: Role
    content: str
    uuid: str
    span_id: Optional[str] = None


class MessagesPayload(BaseModel):
    messages: List[Message]


class MessagesResponse(BaseModel):
    message: Message


class FeedbackRequest(BaseModel):
    feedback: int
    span_id: str
