from __future__ import annotations

import base64
import json
from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, Literal

import httpx
from pydantic import SecretStr

CODEX_ACCESS_TOKEN_SECRET_KEY: Literal["OPENAI_CODEX_ACCESS_TOKEN"] = "OPENAI_CODEX_ACCESS_TOKEN"

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


def encode_device_code(*, device_auth_id: str, user_code: str) -> str:
    """Pack OpenAI's two-part device handle into one opaque RFC 8628 ``device_code``.

    OpenAI's device-auth token exchange wants both the ``device_auth_id`` and the
    ``user_code`` back, whereas RFC 8628 hands the client a single ``device_code``.
    Packing both keeps the public contract standard and the client ignorant of the
    upstream shape.
    """
    payload = json.dumps(
        {"device_auth_id": device_auth_id, "user_code": user_code},
        separators=(",", ":"),
    ).encode()
    return base64.urlsafe_b64encode(payload).rstrip(b"=").decode()


def decode_device_code(device_code: str) -> tuple[str, str] | None:
    """Inverse of :func:`encode_device_code`; ``None`` if the code is not one of ours."""
    padded = device_code + "=" * (-len(device_code) % 4)
    try:
        payload = json.loads(base64.urlsafe_b64decode(padded))
    except (ValueError, TypeError):
        return None
    if not isinstance(payload, dict):
        return None
    device_auth_id = payload.get("device_auth_id")
    user_code = payload.get("user_code")
    if not isinstance(device_auth_id, str) or not isinstance(user_code, str):
        return None
    if not device_auth_id or not user_code:
        return None
    return device_auth_id, user_code


def resolve_codex_access_token(request_credentials: Mapping[str, SecretStr]) -> SecretStr | None:
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
    """Codex nests the account id under the ``https://api.openai.com/auth`` claim."""
    payload = jwt_payload(token)
    if payload is None:
        return None
    auth = payload.get("https://api.openai.com/auth")
    if not isinstance(auth, dict):
        return None
    account_id = auth.get("chatgpt_account_id")
    return account_id if isinstance(account_id, str) else None


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
