import strawberry
from strawberry.relay import Node, NodeID

from phoenix.db import models

# Admin-managed groups; IdP groups use "ldap" / "oauth2:<idp>" and are read-only here.
LOCAL_PROVIDER = "local"


@strawberry.type
class UserGroup(Node):
    """A group of users, usable as a grant subject. **Local** groups are admin-managed
    in-product (the no-IdP path); IdP groups are materialized from OAuth2/LDAP claims at
    login and are read-only here."""

    id: NodeID[int]
    # Keep the row id for existing group-management mutations, which are not Relay-node based.
    group_id: int
    name: str
    provider: str
    is_local: bool
    member_user_ids: list[int]


def to_gql_user_group(group: models.UserGroup, member_user_ids: list[int]) -> UserGroup:
    return UserGroup(
        id=group.id,
        group_id=group.id,
        name=group.display_name or group.group_key,
        provider=group.provider,
        is_local=group.provider == LOCAL_PROVIDER,
        member_user_ids=member_user_ids,
    )
