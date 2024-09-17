from dataclasses import dataclass

from phoenix.server.types import PasswordResetToken


@dataclass(frozen=True)
class PasswordResetTemplateBody:
    token: PasswordResetToken
    base_url: str
