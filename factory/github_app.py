"""Installation tokens for the factory's GitHub App, kept current in the sessions that use them.

An installation token lasts an hour and a session can run for several, so GitHubAppToken
mints a new token before the old one expires and writes it to the GitHub vault, which the
GitHub MCP server and `gh` in the sandbox read, and to the repo mount of every session it
follows, which `git push` uses. Whatever holds the token acts as the app's bot account.
"""

import json
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import anthropic
import jwt

GITHUB_API_URL = "https://api.github.com"
GITHUB_MCP_SERVER_URL = "https://api.githubcopilot.com/mcp/"
GH_TOKEN_SECRET_NAME = "GH_TOKEN"
# A session pushes factory/ branches, opens PRs and comments on issues and PRs. Without the
# Workflows permission, GitHub refuses any push that touches .github/workflows.
TOKEN_PERMISSIONS = {"contents": "write", "issues": "write", "pull_requests": "write"}
# Re-mint once a token has less than this left, so no session holds one that expires mid-call.
REFRESH_MARGIN = timedelta(minutes=20)
MAX_REQUEST_ATTEMPTS = 3


def request_github(*, method: str, path: str, bearer: str, body: Optional[dict] = None) -> Any:
    request = urllib.request.Request(
        f"{GITHUB_API_URL}{path}",
        method=method,
        data=json.dumps(body).encode() if body is not None else None,
        headers={
            "Authorization": f"Bearer {bearer}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
        },
    )
    # A token is minted every ~40 minutes of a multi-hour watch; one GitHub blip shouldn't end it.
    for attempt in range(MAX_REQUEST_ATTEMPTS):
        try:
            with urllib.request.urlopen(request, timeout=60) as response:
                return json.load(response)
        except urllib.error.HTTPError as error:
            if error.code < 500 or attempt == MAX_REQUEST_ATTEMPTS - 1:
                # GitHub's message names the cause, such as permissions the app was never granted.
                detail = error.read().decode(errors="replace")
                message = f"GitHub {method} {path} returned {error.code}: {detail}"
                raise RuntimeError(message) from error
        except urllib.error.URLError:
            if attempt == MAX_REQUEST_ATTEMPTS - 1:
                raise
        time.sleep(5 * 2**attempt)


class GitHubAppToken:
    def __init__(
        self,
        *,
        client: anthropic.Anthropic,
        repo: str,
        vault_id: str,
        app_client_id: str,
        app_private_key: str,
    ) -> None:
        self.client = client
        self.repo = repo
        self.vault_id = vault_id
        self.app_client_id = app_client_id
        self.app_private_key = app_private_key
        self.token: Optional[str] = None
        self.expires_at = datetime.min.replace(tzinfo=timezone.utc)
        # Session ID to the ID of its github_repository resource.
        self.repo_resource_ids: dict[str, str] = {}

    def follow_session(self, *, session_id: str) -> None:
        """Rotate the session's repo mount token whenever the token is re-minted."""
        for resource in self.client.beta.sessions.resources.list(session_id):
            if resource.type == "github_repository":
                self.repo_resource_ids[session_id] = resource.id

    def refresh(self) -> str:
        """Return a token with REFRESH_MARGIN left, minting and distributing a new one if needed."""
        if self.token is not None and datetime.now(timezone.utc) < self.expires_at - REFRESH_MARGIN:
            return self.token
        token, expires_at = self.mint()
        self.write_vault_credentials(token=token)
        for session_id, resource_id in list(self.repo_resource_ids.items()):
            try:
                self.client.beta.sessions.resources.update(
                    resource_id, session_id=session_id, authorization_token=token
                )
            except anthropic.APIStatusError as error:
                print(f"::warning::Could not rotate the repo token of {session_id}: {error}")
                # A terminated session has no use for a token; stop rotating it. Keep a session
                # that hit a rate limit or server error, so the next token still reaches it.
                if error.status_code < 500 and error.status_code != 429:
                    del self.repo_resource_ids[session_id]
        # Cache the token only once it is distributed, so a failure above re-mints next call.
        self.token, self.expires_at = token, expires_at
        return token

    def mint(self) -> tuple[str, datetime]:
        """Mint an installation token limited to this repo and TOKEN_PERMISSIONS."""
        now = int(time.time())
        app_jwt = jwt.encode(
            {"iat": now - 60, "exp": now + 540, "iss": self.app_client_id},
            self.app_private_key,
            algorithm="RS256",
        )
        installation = request_github(
            method="GET", path=f"/repos/{self.repo}/installation", bearer=app_jwt
        )
        access = request_github(
            method="POST",
            path=f"/app/installations/{installation['id']}/access_tokens",
            bearer=app_jwt,
            body={"repositories": [self.repo.split("/")[1]], "permissions": TOKEN_PERMISSIONS},
        )
        return access["token"], datetime.fromisoformat(access["expires_at"].replace("Z", "+00:00"))

    def write_vault_credentials(self, *, token: str) -> None:
        """Write the token to the vault's GitHub MCP and GH_TOKEN credentials, or create them."""
        mcp_credential_id = None
        gh_token_credential_id = None
        for credential in self.client.beta.vaults.credentials.list(self.vault_id):
            auth = credential.auth
            # The vault matches MCP URLs without regard to a trailing slash.
            if auth.type == "static_bearer" and (
                auth.mcp_server_url.rstrip("/") == GITHUB_MCP_SERVER_URL.rstrip("/")
            ):
                mcp_credential_id = credential.id
            elif auth.type == "environment_variable" and auth.secret_name == GH_TOKEN_SECRET_NAME:
                gh_token_credential_id = credential.id

        if mcp_credential_id is None:
            self.client.beta.vaults.credentials.create(
                self.vault_id,
                display_name="GitHub MCP",
                auth={
                    "type": "static_bearer",
                    "mcp_server_url": GITHUB_MCP_SERVER_URL,
                    "token": token,
                },
            )
        else:
            self.client.beta.vaults.credentials.update(
                mcp_credential_id,
                vault_id=self.vault_id,
                auth={"type": "static_bearer", "token": token},
            )
        # Header injection only, so `gh` in the sandbox can call GitHub but the token is never
        # substituted into a request body the agent wrote.
        if gh_token_credential_id is None:
            self.client.beta.vaults.credentials.create(
                self.vault_id,
                display_name="gh CLI",
                auth={
                    "type": "environment_variable",
                    "secret_name": GH_TOKEN_SECRET_NAME,
                    "secret_value": token,
                    "networking": {"type": "limited", "allowed_hosts": ["api.github.com"]},
                    "injection_location": {"header": True},
                },
            )
        else:
            self.client.beta.vaults.credentials.update(
                gh_token_credential_id,
                vault_id=self.vault_id,
                auth={"type": "environment_variable", "secret_value": token},
            )
