from typing import Optional

from starlette.requests import Request as StarletteRequest

from phoenix.server.bearer_auth import PhoenixSystemUser, PhoenixUser

PHOENIX_REQUEST_SOURCE_HEADER = "X-Phoenix-Request-Source"
PXI_REQUEST_SOURCE = "pxi"


def get_request_source(request: Optional[StarletteRequest]) -> Optional[str]:
    if request is None:
        return None
    value = request.headers.get(PHOENIX_REQUEST_SOURCE_HEADER)
    if not value:
        return None
    return value.strip().lower() or None


def is_pxi_request(request: Optional[StarletteRequest]) -> bool:
    return get_request_source(request) == PXI_REQUEST_SOURCE


class PxiDowngradedPhoenixUser(PhoenixUser):
    """
    A PhoenixUser wrapper used when a GraphQL request self-identifies as PXI.

    Downgrades admin to effective member (is_admin=False, is_viewer=False),
    preserves viewer status, and leaves member unchanged. Not applied to
    PhoenixSystemUser (callers should check before wrapping).
    """

    def __init__(self, base: PhoenixUser) -> None:
        # Intentionally does not call super().__init__: PhoenixUser.__init__
        # re-derives _is_admin/_is_viewer from claims, which would undo the
        # downgrade.
        self._user_id = base._user_id
        self.claims = base.claims
        self._is_admin = False
        self._is_viewer = base._is_viewer


def downgrade_if_pxi(
    user: PhoenixUser,
    *,
    request: Optional[StarletteRequest],
) -> PhoenixUser:
    """
    Return a PXI-downgraded wrapper for the given user when the request is
    PXI-marked. System users, non-`PhoenixUser` principals (e.g. the
    unauthenticated user when auth is disabled), and unmarked requests are
    passed through unchanged.
    """
    if not isinstance(user, PhoenixUser) or isinstance(user, PhoenixSystemUser):
        return user
    if not is_pxi_request(request):
        return user
    return PxiDowngradedPhoenixUser(user)
