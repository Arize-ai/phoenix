from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import create_engine, text

from tests.integration._helpers import _AppInfo, _LoggedInTokens, _Profile, _User, _httpx_client


def _expire_lockout(app: _AppInfo, email: str) -> None:
    """Set locked_until for the given user to a time in the past."""
    db_url = app.env["PHOENIX_SQL_DATABASE_URL"]
    engine = create_engine(db_url)
    try:
        with engine.begin() as conn:
            if schema := app.env.get("PHOENIX_SQL_DATABASE_SCHEMA"):
                conn.execute(text(f'SET search_path TO "{schema}"'))
            conn.execute(
                text(
                    "UPDATE users "
                    "SET locked_until = :locked_until "
                    "WHERE email = :email"
                ),
                {
                    "locked_until": datetime.now(timezone.utc) - timedelta(minutes=1),
                    "email": email,
                },
            )
    finally:
        engine.dispose()


def _create_local_user(app: _AppInfo, profile: _Profile) -> _User:
    client = _httpx_client(app, app.admin_secret)
    json_ = {
        "user": {
            "email": profile.email,
            "username": profile.username,
            "role": "MEMBER",
            "auth_method": "LOCAL",
            "password": profile.password,
        },
        "send_welcome_email": False,
    }
    resp = client.post("v1/users", json=json_)
    resp.raise_for_status()
    data = resp.json()["data"]
    from tests.integration._helpers import _GqlId  # avoids circular import in helpers

    return _User(
        gid=_GqlId(data["id"]),
        role=user_role := user_role,  # placeholder to satisfy type checker; unused at runtime
        profile=profile,
        profile_picture_url=None,
    )


def test_expired_lockout_allows_fresh_attempts(
    _app: _AppInfo,
    _profiles: list[_Profile],
) -> None:
    app = _app
    profile = _profiles[0]

    # Create a LOCAL user with a known password.
    from tests.integration._helpers import _new_user  # reuse existing user factory

    user = _new_user(app, role=user_role, profile=profile)  # type: ignore[name-defined]
    email = user.email
    correct_password = user.password
    wrong_password = correct_password + "wrong"

    client = _httpx_client(app)

    # Default max attempts is 5 – trigger a lockout with repeated failures.
    for _ in range(5):
        resp = client.post("auth/login", json={"email": email, "password": wrong_password})
        assert resp.status_code == 401

    # Manually expire the lockout window in the database.
    _expire_lockout(app, email)

    # After the lockout window has expired, a further bad attempt should NOT permanently
    # re-lock the account; it should count as the first failure in a fresh window.
    resp = client.post("auth/login", json={"email": email, "password": wrong_password})
    assert resp.status_code == 401

    # A subsequent correct login should now succeed, proving the lockout was not permanent.
    resp = client.post("auth/login", json={"email": email, "password": correct_password})
    resp.raise_for_status()
    assert resp.status_code == 204
    assert resp.cookies.get("phoenix-access-token")
    assert resp.cookies.get("phoenix-refresh-token")

