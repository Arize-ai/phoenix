from datetime import datetime, timezone
from secrets import token_hex

from phoenix.db import models
from phoenix.server.api.dataloaders.user_credential_counts import (
    UserCredentialCounts,
    UserCredentialCountsDataLoader,
)
from phoenix.server.types import DbSessionFactory


async def test_user_credential_counts_batches_active_credentials(
    db: DbSessionFactory,
) -> None:
    async with db() as session:
        member_role = models.UserRole(name="MEMBER")
        session.add(member_role)
        await session.flush()
        users = [
            models.OAuth2User(
                email=f"{token_hex(8)}@example.com",
                username=token_hex(8),
                user_role_id=member_role.id,
            )
            for _ in range(2)
        ]
        session.add_all(users)
        await session.flush()

        client = models.OAuth2Client(
            client_id=token_hex(8),
            name="Credential count test client",
            redirect_uris=["http://localhost/callback"],
            grant_types=["authorization_code", "refresh_token"],
            token_endpoint_auth_method="none",
            is_first_party=False,
        )
        session.add(client)
        await session.flush()

        session.add_all(
            [
                models.ApiKey(user_id=users[0].id, name="one", description=None),
                models.ApiKey(user_id=users[0].id, name="two", description=None),
                models.ApiKey(user_id=users[1].id, name="three", description=None),
                models.OAuth2Grant(
                    user_id=users[0].id,
                    oauth2_client_id=client.id,
                    scopes=[],
                ),
                models.OAuth2Grant(
                    user_id=users[0].id,
                    oauth2_client_id=client.id,
                    scopes=[],
                    revoked_at=datetime.now(timezone.utc),
                ),
            ]
        )
        await session.flush()
        user_ids = [user.id for user in users]

    missing_user_id = max(user_ids) + 10_000
    counts = await UserCredentialCountsDataLoader(db)._load_fn(
        [user_ids[0], user_ids[1], missing_user_id, user_ids[0]]
    )

    assert counts == [
        UserCredentialCounts(api_key_count=2, oauth2_grant_count=1),
        UserCredentialCounts(api_key_count=1, oauth2_grant_count=0),
        UserCredentialCounts(),
        UserCredentialCounts(api_key_count=2, oauth2_grant_count=1),
    ]
