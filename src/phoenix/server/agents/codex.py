"""ChatGPT/Codex subscription auth for the PXI server agent.

Experimental. A user signs in to their ChatGPT account from the browser with
the OAuth *device code* flow of the public Codex CLI client. The resulting
token bundle lives only in the browser; the access token rides each chat
request as a ``credentials`` entry and is never
persisted or traced server-side. The server's role in the login is limited to
stateless pass-through calls to ``auth.openai.com`` (the browser cannot call
them directly because of CORS) and, at turn time, wiring the token into
``pydantic_ai``'s ``OpenAICodexProvider``.

The device flow mirrors ``codex-rs/login/src/device_code_auth.rs``:

1. ``POST /api/accounts/deviceauth/usercode`` → ``device_auth_id``, ``user_code``.
2. The user opens ``https://auth.openai.com/codex/device`` and enters the code.
3. ``POST /api/accounts/deviceauth/token`` is polled; 403/404 mean *pending*,
   2xx returns an ``authorization_code`` plus its PKCE ``code_verifier``.
4. The code is exchanged at ``/oauth/token`` with redirect URI
   ``https://auth.openai.com/deviceauth/callback``.

The account must have "Enable device code authorization for Codex" turned on
in ChatGPT's security settings (a workspace admin setting on team accounts).
"""

from __future__ import annotations

import base64
import json
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Literal

import httpx
from pydantic import SecretStr

CODEX_ACCESS_TOKEN_SECRET_KEY: Literal["OPENAI_CODEX_ACCESS_TOKEN"] = "OPENAI_CODEX_ACCESS_TOKEN"

# The public Codex CLI client. Its registration is what makes the device flow
# (and the pinned localhost redirect of the PKCE flow) work.
CODEX_CLIENT_ID = "app_EMoamEEZ73f0CkXaXp7hrann"
CODEX_AUTH_ISSUER = "https://auth.openai.com"
CODEX_DEVICE_VERIFICATION_URL = f"{CODEX_AUTH_ISSUER}/codex/device"
CODEX_BACKEND_URL = "https://chatgpt.com/backend-api/codex"
# The models endpoint 404s without a client_version and hides every model whose
# minimum Codex CLI version is newer than the one sent. A far-future version
# keeps the list complete without pinning a release that goes stale.
_CODEX_MODELS_CLIENT_VERSION = "999.0.0"
_HTTP_TIMEOUT = httpx.Timeout(timeout=30, connect=5)


class CodexAuthError(Exception):
    def __init__(self, message: str, *, status_code: int = 502) -> None:
        super().__init__(message)
        self.status_code = status_code


@dataclass(frozen=True)
class CodexDeviceAuthStart:
    device_auth_id: str
    user_code: str
    interval_seconds: int
    verification_url: str


@dataclass(frozen=True)
class CodexTokens:
    access_token: str
    refresh_token: str
    id_token: str | None
    account_id: str


def resolve_codex_access_token(request_credentials: Mapping[str, SecretStr]) -> SecretStr | None:
    """No workspace-secret or environment fallback, unlike the GitHub token: a
    subscription token is personal, and OpenAI's guidance is not to pool or share it.
    """
    token = request_credentials.get(CODEX_ACCESS_TOKEN_SECRET_KEY)
    if token is not None and token.get_secret_value():
        return token
    return None


def jwt_payload(token: str) -> dict[str, Any] | None:
    """Decode a JWT payload without verifying the signature (a hint, not an authority)."""
    try:
        segment = token.split(".")[1]
    except IndexError:
        return None
    padded = segment + "=" * (-len(segment) % 4)
    try:
        payload = json.loads(base64.urlsafe_b64decode(padded))
    except (ValueError, TypeError):
        return None
    return payload if isinstance(payload, dict) else None


def account_id_from_token(token: str) -> str | None:
    """Codex nests the id under the ``https://api.openai.com/auth`` claim; older
    token shapes carry it top-level."""
    payload = jwt_payload(token)
    if payload is None:
        return None
    auth = payload.get("https://api.openai.com/auth")
    if isinstance(auth, dict) and isinstance(auth.get("chatgpt_account_id"), str):
        return str(auth["chatgpt_account_id"])
    for key in ("chatgpt_account_id", "account_id"):
        if isinstance(payload.get(key), str):
            return str(payload[key])
    return None


def _tokens_from_response(data: Mapping[str, Any]) -> CodexTokens:
    access_token = data.get("access_token")
    refresh_token = data.get("refresh_token")
    if not isinstance(access_token, str) or not access_token:
        raise CodexAuthError("Token response did not include an access token.")
    if not isinstance(refresh_token, str) or not refresh_token:
        raise CodexAuthError("Token response did not include a refresh token.")
    id_token = data.get("id_token") if isinstance(data.get("id_token"), str) else None
    account_id = (
        (data.get("account_id") if isinstance(data.get("account_id"), str) else None)
        or (account_id_from_token(id_token) if id_token else None)
        or account_id_from_token(access_token)
    )
    if not account_id:
        raise CodexAuthError("Could not determine the ChatGPT account id from the token response.")
    return CodexTokens(
        access_token=access_token,
        refresh_token=refresh_token,
        id_token=id_token,
        account_id=account_id,
    )


async def _post_token_form(client: httpx.AsyncClient, form: Mapping[str, str]) -> CodexTokens:
    response = await client.post(
        f"{CODEX_AUTH_ISSUER}/oauth/token",
        data=dict(form),
        headers={"Accept": "application/json"},
    )
    if response.status_code != 200:
        detail: str
        try:
            body = response.json()
            detail = str(body.get("error_description") or body.get("error") or response.text[:200])
        except ValueError:
            detail = response.text[:200]
        raise CodexAuthError(
            f"OpenAI token endpoint returned {response.status_code}: {detail}",
            status_code=401 if response.status_code in (400, 401) else 502,
        )
    try:
        data = response.json()
    except ValueError as exc:
        raise CodexAuthError("OpenAI token endpoint returned a non-JSON response.") from exc
    return _tokens_from_response(data)


async def start_device_auth(client: httpx.AsyncClient) -> CodexDeviceAuthStart:
    response = await client.post(
        f"{CODEX_AUTH_ISSUER}/api/accounts/deviceauth/usercode",
        json={"client_id": CODEX_CLIENT_ID},
        headers={"Accept": "application/json"},
    )
    if response.status_code != 200:
        raise CodexAuthError(
            f"Could not start device authorization ({response.status_code}): {response.text[:200]}"
        )
    data = response.json()
    device_auth_id = data.get("device_auth_id")
    user_code = data.get("user_code") or data.get("usercode")
    if not isinstance(device_auth_id, str) or not isinstance(user_code, str):
        raise CodexAuthError("Device authorization response was missing required fields.")
    try:
        interval = max(1, int(data.get("interval") or 5))
    except (TypeError, ValueError):
        interval = 5
    return CodexDeviceAuthStart(
        device_auth_id=device_auth_id,
        user_code=user_code,
        interval_seconds=interval,
        verification_url=CODEX_DEVICE_VERIFICATION_URL,
    )


async def poll_device_auth(
    client: httpx.AsyncClient,
    *,
    device_auth_id: str,
    user_code: str,
) -> CodexTokens | None:
    """``None`` while the user has not finished signing in."""
    response = await client.post(
        f"{CODEX_AUTH_ISSUER}/api/accounts/deviceauth/token",
        json={"device_auth_id": device_auth_id, "user_code": user_code},
        headers={"Accept": "application/json"},
    )
    if response.status_code in (403, 404):
        return None
    if response.status_code >= 400:
        raise CodexAuthError(
            f"Device authorization failed ({response.status_code}): {response.text[:200]}",
            status_code=401 if response.status_code in (400, 401, 410) else 502,
        )
    data = response.json()
    authorization_code = data.get("authorization_code")
    code_verifier = data.get("code_verifier")
    if not isinstance(authorization_code, str) or not isinstance(code_verifier, str):
        raise CodexAuthError("Device authorization completed without an authorization code.")
    return await _post_token_form(
        client,
        {
            "grant_type": "authorization_code",
            "code": authorization_code,
            "code_verifier": code_verifier,
            "redirect_uri": f"{CODEX_AUTH_ISSUER}/deviceauth/callback",
            "client_id": CODEX_CLIENT_ID,
        },
    )


async def refresh_tokens(client: httpx.AsyncClient, *, refresh_token: str) -> CodexTokens:
    """Refresh tokens are single-use: the caller must replace its stored bundle."""
    return await _post_token_form(
        client,
        {
            "grant_type": "refresh_token",
            "refresh_token": refresh_token,
            "client_id": CODEX_CLIENT_ID,
        },
    )


async def list_models(client: httpx.AsyncClient, *, access_token: str) -> list[str]:
    account_id = account_id_from_token(access_token)
    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
        "originator": "pydantic-ai",
    }
    if account_id:
        headers["chatgpt-account-id"] = account_id
    response = await client.get(
        f"{CODEX_BACKEND_URL}/models",
        params={"client_version": _CODEX_MODELS_CLIENT_VERSION},
        headers=headers,
    )
    if response.status_code == 401:
        raise CodexAuthError("ChatGPT session expired. Sign in again.", status_code=401)
    if response.status_code != 200:
        raise CodexAuthError(
            f"Could not list Codex models ({response.status_code}): {response.text[:200]}"
        )
    data = response.json()
    models = data.get("models") if isinstance(data, dict) else None
    slugs: list[str] = []
    for model in models or []:
        if not isinstance(model, dict) or model.get("visibility", "list") != "list":
            continue
        slug = model.get("slug")
        if isinstance(slug, str) and slug and slug not in slugs:
            slugs.append(slug)
    return slugs


def http_client() -> httpx.AsyncClient:
    return httpx.AsyncClient(timeout=_HTTP_TIMEOUT)
