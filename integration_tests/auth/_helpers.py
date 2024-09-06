from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Iterator, Optional, Protocol, Tuple, cast
from urllib.parse import urljoin

import httpx
from phoenix.auth import PHOENIX_ACCESS_TOKEN_COOKIE_NAME, PHOENIX_REFRESH_TOKEN_COOKIE_NAME
from phoenix.config import get_base_url
from phoenix.server.api.auth import IsAdmin, IsAuthenticated
from phoenix.server.api.exceptions import Unauthorized
from phoenix.server.api.input_types.UserRoleInput import UserRoleInput
from typing_extensions import TypeAlias

from .._helpers import _httpx_client

_Email: TypeAlias = str
_GqlId: TypeAlias = str
_Name: TypeAlias = str
_Password: TypeAlias = str
_Token: TypeAlias = str
_Username: TypeAlias = str
_AccessToken: TypeAlias = _Token
_ApiKey: TypeAlias = _Token
_RefreshToken: TypeAlias = _Token


@dataclass(frozen=True)
class _Profile:
    email: _Email
    password: _Password
    username: Optional[_Username] = None


@dataclass(frozen=True)
class _User:
    gid: _GqlId
    role: UserRoleInput
    profile: _Profile


@dataclass(frozen=True)
class _LoggedInTokens:
    access: _AccessToken
    refresh: _RefreshToken

    def log_out(self) -> None:
        _log_out(self.access)

    def __iter__(self) -> Iterator[_Token]:
        yield self.access
        yield self.refresh

    def __enter__(self) -> _LoggedInTokens:
        return self

    def __exit__(self, *args: Any, **kwargs: Any) -> None:
        self.log_out()


@dataclass(frozen=True)
class _LoggedInUser(_User):
    tokens: _LoggedInTokens


class _UserGenerator(Protocol):
    def send(self, role: UserRoleInput) -> _LoggedInUser: ...


class _GetNewUser(Protocol):
    def __call__(self, role: UserRoleInput) -> _LoggedInUser: ...


def _create_user(
    token: Optional[_Token],
    /,
    *,
    email: _Email,
    password: _Password,
    role: UserRoleInput,
    username: Optional[_Username] = None,
) -> _GqlId:
    args = [f'email:"{email}"', f'password:"{password}"', f"role:{role.value}"]
    if username:
        args.append(f'username:"{username}"')
    out = "user{id email role{name}}"
    query = "mutation{createUser(input:{" + ",".join(args) + "}){" + out + "}}"
    resp = _httpx_client().post(
        urljoin(get_base_url(), "graphql"),
        json=dict(query=query),
        cookies={PHOENIX_ACCESS_TOKEN_COOKIE_NAME: token} if token else {},
    )
    resp_dict = _json(resp)
    assert (user := resp_dict["data"]["createUser"]["user"])
    assert user["email"] == email
    assert user["role"]["name"] == role.value
    return cast(_GqlId, user["id"])


def _patch_user(
    token: Optional[_Token],
    gid: _GqlId,
    /,
    *,
    new_username: Optional[_Username] = None,
    new_password: Optional[_Password] = None,
    new_role: Optional[UserRoleInput] = None,
) -> None:
    args = [f'userId:"{gid}"']
    if new_password:
        args.append(f'newPassword:"{new_password}"')
    if new_username:
        args.append(f'newUsername:"{new_username}"')
    if new_role:
        args.append(f"newRole:{new_role.value}")
    out = "user{id username role{name}}"
    query = "mutation{patchUser(input:{" + ",".join(args) + "}){" + out + "}}"
    resp = _httpx_client().post(
        urljoin(get_base_url(), "graphql"),
        json=dict(query=query),
        cookies={PHOENIX_ACCESS_TOKEN_COOKIE_NAME: token} if token else {},
    )
    resp_dict = _json(resp)
    assert (user := resp_dict["data"]["patchUser"]["user"])
    assert user["id"] == gid
    if new_username:
        assert user["username"] == new_username
    if new_role:
        assert user["role"]["name"] == new_role.value


def _patch_viewer(
    token: Optional[_Token],
    current_password: Optional[_Password],
    /,
    *,
    new_username: Optional[_Username] = None,
    new_password: Optional[_Password] = None,
) -> None:
    args = []
    if new_password:
        args.append(f'newPassword:"{new_password}"')
    if current_password:
        args.append(f'currentPassword:"{current_password}"')
    if new_username:
        args.append(f'newUsername:"{new_username}"')
    out = "user{username}"
    query = "mutation{patchViewer(input:{" + ",".join(args) + "}){" + out + "}}"
    resp = _httpx_client().post(
        urljoin(get_base_url(), "graphql"),
        json=dict(query=query),
        cookies={PHOENIX_ACCESS_TOKEN_COOKIE_NAME: token} if token else {},
    )
    resp_dict = _json(resp)
    assert (user := resp_dict["data"]["patchViewer"]["user"])
    if new_username:
        assert user["username"] == new_username


def _create_system_api_key(
    token: Optional[_Token],
    /,
    *,
    name: _Name,
    expires_at: Optional[datetime] = None,
) -> Tuple[_ApiKey, _GqlId]:
    exp = f' expiresAt:"{expires_at.isoformat()}"' if expires_at else ""
    args, out = (f'name:"{name}"' + exp), "jwt apiKey{id name expiresAt}"
    query = "mutation{createSystemApiKey(input:{" + args + "}){" + out + "}}"
    resp = _httpx_client().post(
        urljoin(get_base_url(), "graphql"),
        json=dict(query=query),
        cookies={PHOENIX_ACCESS_TOKEN_COOKIE_NAME: token} if token else {},
    )
    resp_dict = _json(resp)
    assert (result := resp_dict["data"]["createSystemApiKey"])
    assert (api_key := result["apiKey"])
    assert api_key["name"] == name
    exp_t = datetime.fromisoformat(api_key["expiresAt"]) if api_key["expiresAt"] else None
    assert exp_t == expires_at
    return cast(_ApiKey, result["jwt"]), cast(_GqlId, api_key["id"])


def _delete_system_api_key(token: Optional[_Token], gid: _GqlId, /) -> None:
    args, out = f'id:"{gid}"', "apiKeyId"
    query = "mutation{deleteSystemApiKey(input:{" + args + "}){" + out + "}}"
    resp = _httpx_client().post(
        urljoin(get_base_url(), "graphql"),
        json=dict(query=query),
        cookies={PHOENIX_ACCESS_TOKEN_COOKIE_NAME: token} if token else {},
    )
    resp_dict = _json(resp)
    assert resp_dict["data"]["deleteSystemApiKey"]["apiKeyId"] == gid


def _log_in(password: _Password, /, *, email: _Email) -> _LoggedInTokens:
    resp = _httpx_client().post(
        urljoin(get_base_url(), "auth/login"),
        json={"email": email, "password": password},
    )
    resp.raise_for_status()
    assert (access_token := resp.cookies.get(PHOENIX_ACCESS_TOKEN_COOKIE_NAME))
    assert (refresh_token := resp.cookies.get(PHOENIX_REFRESH_TOKEN_COOKIE_NAME))
    return _LoggedInTokens(access_token, refresh_token)


def _log_out(token: _Token, /) -> None:
    resp = _httpx_client().post(
        urljoin(get_base_url(), "auth/logout"),
        cookies={PHOENIX_ACCESS_TOKEN_COOKIE_NAME: token},
    )
    resp.raise_for_status()


def _json(resp: httpx.Response) -> Dict[str, Any]:
    resp.raise_for_status()
    assert (resp_dict := cast(Dict[str, Any], resp.json()))
    if errers := resp_dict.get("errors"):
        msg = errers[0]["message"]
        if "not auth" in msg or IsAuthenticated.message in msg or IsAdmin.message in msg:
            raise Unauthorized(msg)
        raise RuntimeError(msg)
    return resp_dict
