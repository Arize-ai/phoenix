"""GraphQL admin-gating for the local-group mutations + query.

The happy-path logic (create / delete-sweep / membership over the `user_groups` and
`acls` tables) is exercised by the REST suite (`routers/v1/test_access.py`) against the
identical models — `require_admin` is open when auth is disabled, so those tests can run
it. The local-group GraphQL mutations use ``IsAdmin``, which is *closed* when auth is
disabled, so the default client cannot reach the resolver body — what a unit test can assert
here is that the surface exists with the right shape and is admin-gated.
"""

from tests.unit.graphql import AsyncGraphQLClient

_CREATE = """
mutation ($name: String!) {
  createUserGroup(name: $name) { userGroup { groupId name provider isLocal memberUserIds } }
}
"""
_DELETE = "mutation ($g: Int!) { deleteUserGroup(groupId: $g) { query { __typename } } }"
_ADD = """
mutation ($g: Int!, $u: Int!) {
  addUserGroupMember(groupId: $g, userId: $u) { userGroup { groupId memberUserIds } }
}
"""
_REMOVE = """
mutation ($g: Int!, $u: Int!) {
  removeUserGroupMember(groupId: $g, userId: $u) { userGroup { groupId memberUserIds } }
}
"""
_LIST = """
query ($localOnly: Boolean!) {
  userGroups(localOnly: $localOnly) { groupId name isLocal memberUserIds }
}
"""


def _is_admin_error(result: object) -> bool:
    errors = getattr(result, "errors", None)
    return bool(errors) and "admin" in str(errors).lower()


class TestUserGroupSurfaceIsAdminGated:
    async def test_mutations_require_admin(self, gql_client: AsyncGraphQLClient) -> None:
        # Each mutation exists with the right input shape (no validation error) and is
        # rejected for the non-admin default client (the admin guard, not a 400).
        for query, variables in (
            (_CREATE, {"name": "team-x"}),
            (_DELETE, {"g": 1}),
            (_ADD, {"g": 1, "u": 1}),
            (_REMOVE, {"g": 1, "u": 1}),
        ):
            result = await gql_client.execute(query, variables)
            assert _is_admin_error(result), (query, result.errors)

    async def test_query_requires_admin(self, gql_client: AsyncGraphQLClient) -> None:
        result = await gql_client.execute(_LIST, {"localOnly": True})
        assert _is_admin_error(result), result.errors
