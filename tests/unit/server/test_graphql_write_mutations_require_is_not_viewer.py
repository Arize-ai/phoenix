from __future__ import annotations

from strawberry.types.base import StrawberryObjectDefinition

from phoenix.server.api.auth import IsNotViewer
from phoenix.server.api.mutations import Mutation

_ALLOWLIST = {
    # A user can manage their own user-scoped API keys; role-specific write access
    # is enforced elsewhere for system-scoped API keys.
    "create_user_api_key",
    "delete_user_api_key",
    # A viewer can update their own profile fields.
    "patch_viewer",
    # A user can revoke their own OAuth2 authorized-application sessions.
    "revoke_oauth2_grant",
}


def test_graphql_write_mutations_require_is_not_viewer_or_allowlist() -> None:
    definition = getattr(Mutation, "__strawberry_definition__")
    assert isinstance(definition, StrawberryObjectDefinition)
    missing = []
    for field in definition.fields:
        permission_classes = field.permission_classes or []
        if IsNotViewer not in permission_classes and field.name not in _ALLOWLIST:
            missing.append(field.name)

    assert missing == []
