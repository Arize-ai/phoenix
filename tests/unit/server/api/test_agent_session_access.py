from types import SimpleNamespace
from typing import cast

from phoenix.server.api.agent_session_access import (
    can_access_agent_session,
    get_agent_session_owner_filter,
)
from phoenix.server.api.context import Context


def _context(*, user_id: int | None, is_admin: bool) -> Context:
    return cast(
        Context,
        SimpleNamespace(
            user_id=user_id,
            user=SimpleNamespace(is_admin=is_admin),
        ),
    )


def test_admin_can_access_all_agent_sessions() -> None:
    context = _context(user_id=1, is_admin=True)

    assert can_access_agent_session(context, owner_id=2)
    assert get_agent_session_owner_filter(context) is None


def test_member_can_only_access_owned_agent_sessions() -> None:
    context = _context(user_id=1, is_admin=False)

    assert can_access_agent_session(context, owner_id=1)
    assert not can_access_agent_session(context, owner_id=2)
    assert get_agent_session_owner_filter(context) is not None


def test_auth_disabled_can_access_all_agent_sessions() -> None:
    context = _context(user_id=None, is_admin=False)

    assert can_access_agent_session(context, owner_id=None)
    assert can_access_agent_session(context, owner_id=2)
    assert get_agent_session_owner_filter(context) is None
