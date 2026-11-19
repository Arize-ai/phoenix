"""Resolution of the GitHub token and MCP endpoint the PXI GitHub tools run on.

The token is resolved once per turn, with per-user credentials taking
precedence over workspace-wide configuration:

1. A credential supplied on the chat request (the user's own PAT, kept by the
   client — browser local storage or the CLI profile — and never persisted
   server-side), so issues are filed as the requesting user.
2. The workspace secret ``GITHUB_PERSONAL_ACCESS_TOKEN`` (admin-managed,
   encrypted at rest in the ``secrets`` table).
3. The ``GITHUB_PERSONAL_ACCESS_TOKEN`` process environment variable.
"""

from __future__ import annotations

import logging
from collections.abc import Callable, Mapping
from dataclasses import dataclass
from os import getenv
from typing import Literal

import sqlalchemy as sa
from pydantic import SecretStr
from sqlalchemy.ext.asyncio import AsyncSession
from typing_extensions import TypeAlias

from phoenix.config import get_env_phoenix_agents_github_mcp_url
from phoenix.db import models

logger = logging.getLogger(__name__)

ChatRequestCredentialKey: TypeAlias = Literal["GITHUB_PERSONAL_ACCESS_TOKEN"]
"""Secret-key names accepted as per-request credentials on the chat endpoint.

Typing the wire field with this alias makes pydantic reject unknown keys and
puts the accepted keys in the OpenAPI schema, so both TypeScript clients
type-check their key literals against it. Future integrations widen the
Literal here rather than editing the chat router.
"""

GITHUB_PAT_SECRET_KEY: ChatRequestCredentialKey = "GITHUB_PERSONAL_ACCESS_TOKEN"


@dataclass(frozen=True)
class GitHubMCPConfig:
    """Connection parameters for the GitHub MCP toolset of a single agent run."""

    token: SecretStr
    base_url: str


async def resolve_github_mcp_config(
    session: AsyncSession,
    decrypt: Callable[[bytes], bytes],
    request_credentials: Mapping[str, SecretStr],
) -> GitHubMCPConfig | None:
    """Resolve a turn's GitHub MCP connection, or ``None`` when no token is configured.

    Callers decide *whether* GitHub tools are enabled (see
    ``AgentsEnvConfig.allows_github``); this decides *how* to connect.
    """
    token = await resolve_github_token(session, decrypt, request_credentials)
    if token is None:
        return None
    return GitHubMCPConfig(token=token, base_url=get_env_phoenix_agents_github_mcp_url())


async def resolve_github_token(
    session: AsyncSession,
    decrypt: Callable[[bytes], bytes],
    request_credentials: Mapping[str, SecretStr],
) -> SecretStr | None:
    """Resolve the GitHub token for a turn, or ``None`` when none is configured.

    Precedence: request credential, then workspace secret, then environment.
    An undecryptable workspace secret is skipped (with a warning) rather than
    failing the turn, since the capability is optional.
    """
    request_token = request_credentials.get(GITHUB_PAT_SECRET_KEY)
    if request_token is not None and request_token.get_secret_value():
        return request_token
    encrypted = await session.scalar(
        sa.select(models.Secret.value).where(models.Secret.key == GITHUB_PAT_SECRET_KEY)
    )
    if encrypted is not None:
        if (workspace_token := decrypt_workspace_secret(encrypted, decrypt)) is not None:
            return workspace_token
    if env_token := getenv(GITHUB_PAT_SECRET_KEY):
        return SecretStr(env_token)
    return None


def decrypt_workspace_secret(
    encrypted: bytes,
    decrypt: Callable[[bytes], bytes],
) -> SecretStr | None:
    """Decrypt the stored workspace token, or ``None`` (with a warning) when it can't be.

    Shared by token resolution and the ``githubWorkspaceTokenConfigured``
    existence check so both agree on whether a stored secret is usable — an
    undecryptable row (e.g. after a key rotation) must not be reported as a
    configured fallback identity.
    """
    try:
        return SecretStr(decrypt(encrypted).decode())
    except ValueError:
        # The message is fixed text: no key material, no ciphertext, and no
        # token-named variables that scanners could mistake for a value.
        logger.warning(
            "Stored workspace GitHub token could not be decrypted; falling back to the environment"
        )
        return None
