from pydantic import BaseModel


class User(BaseModel):
    id: int
    name: str
    email: str | None = None
    roles: list[str] = []
