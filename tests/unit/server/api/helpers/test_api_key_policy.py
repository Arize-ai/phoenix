import pytest

from phoenix.server.api.helpers.api_key_policy import (
    ApiKeyOwner,
    UserApiKeyAuthorization,
    can_revoke_user_api_key,
)


@pytest.mark.parametrize(
    "caller_id,caller_is_admin_secret,authorization,expected",
    [
        # Owner revokes their own key.
        (1, False, UserApiKeyAuthorization("VIEWER", ApiKeyOwner(1, "VIEWER")), True),
        # Non-owner, non-admin cannot revoke another user's key.
        (1, False, UserApiKeyAuthorization("MEMBER", ApiKeyOwner(2, "MEMBER")), False),
        # Human admin revokes another user's key.
        (1, False, UserApiKeyAuthorization("ADMIN", ApiKeyOwner(2, "MEMBER")), True),
        # No one may revoke a system-owned key through the user path.
        (1, False, UserApiKeyAuthorization("ADMIN", ApiKeyOwner(2, "SYSTEM")), False),
        # A SYSTEM-role API key cannot revoke any user key.
        (1, False, UserApiKeyAuthorization("SYSTEM", ApiKeyOwner(2, "MEMBER")), False),
        # Missing target key.
        (1, False, UserApiKeyAuthorization("ADMIN", None), False),
        # Missing caller.
        (1, False, None, False),
        # Admin-secret principal: its database role is SYSTEM, but its configured admin
        # authority permits revoking another user's key.
        (99, True, UserApiKeyAuthorization("SYSTEM", ApiKeyOwner(2, "MEMBER")), True),
        # Admin-secret still cannot cross into a system-owned key via the user path.
        (99, True, UserApiKeyAuthorization("SYSTEM", ApiKeyOwner(3, "SYSTEM")), False),
        # Admin-secret with a missing target key is denied without enumeration.
        (99, True, UserApiKeyAuthorization("SYSTEM", None), False),
    ],
)
def test_can_revoke_user_api_key(
    caller_id: int,
    caller_is_admin_secret: bool,
    authorization: UserApiKeyAuthorization | None,
    expected: bool,
) -> None:
    assert (
        can_revoke_user_api_key(
            caller_id=caller_id,
            caller_is_admin_secret=caller_is_admin_secret,
            authorization=authorization,
        )
        is expected
    )
