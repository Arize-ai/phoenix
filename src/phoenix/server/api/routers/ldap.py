import logging
import secrets
from typing import Optional, cast

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from phoenix.auth import sanitize_email
from phoenix.config import LDAPConfig
from phoenix.db import models
from phoenix.server.ldap import LDAP_CLIENT_ID_MARKER, LDAPUserInfo, is_ldap_user

logger = logging.getLogger(__name__)


async def get_or_create_ldap_user(
    session: AsyncSession,
    user_info: LDAPUserInfo,
    ldap_config: LDAPConfig,
) -> models.User:
    """
    Retrieves an existing LDAP user or creates a new one.

    User Identity Strategy:
        Phoenix identifies LDAP users using a stable identifier. The strategy
        depends on whether PHOENIX_LDAP_ATTR_UNIQUE_ID is configured:

        1. If PHOENIX_LDAP_ATTR_UNIQUE_ID is set (e.g., "objectGUID" or "entryUUID"):
           - Stores the immutable LDAP unique ID in oauth2_user_id
           - Primary lookup by oauth2_user_id, fallback by email
           - Survives: DN changes, email changes, renames, OU moves, domain consolidation
           - This is how enterprise IAM systems (Okta, Azure AD Connect) work

        2. Otherwise (default):
           - oauth2_user_id is NULL (no redundant email storage)
           - Lookup by email column directly
           - Survives: DN changes, OU moves, renames
           - Simple setup for most organizations

    Admin-Provisioned Users:
        Admins can pre-create users with oauth2_user_id=NULL. On first login,
        the user is matched by email and oauth2_user_id is populated (if unique_id
        is configured).
    """
    email = sanitize_email(user_info.email)
    unique_id = user_info.unique_id  # None if not configured

    # Step 1: Look up user
    # Strategy depends on whether unique_id is configured
    user: Optional[models.User] = None

    if unique_id:
        # Enterprise mode: lookup by unique_id first
        user = await _lookup_by_unique_id(session, unique_id)

        # Fallback: email lookup (handles migration to unique_id)
        if not user:
            user = await _lookup_by_email(session, email)
            if user:
                # SECURITY: Only migrate if user has no existing unique_id.
                # This prevents an email recycling attack where a new user with
                # a recycled email address could hijack an old user's account.
                #
                # Scenario without this check:
                #   1. User A leaves company (DB: email=john@corp.com, uuid=UUID-A)
                #   2. User B joins with recycled email (LDAP: email=john@corp.com, uuid=UUID-B)
                #   3. User B logs in, email lookup finds User A, UUID-B overwrites UUID-A
                #   4. User B now has access to User A's data!
                #
                # With this check:
                #   - User A already has uuid=UUID-A, so no migration happens
                #   - User B is rejected (403) - admin must resolve the conflict
                #   - Note: We can't create a new user because email is unique in DB
                if user.oauth2_user_id is None:
                    user.oauth2_user_id = unique_id
                elif user.oauth2_user_id.lower() != unique_id.lower():
                    # Email matches but unique_id differs - this is a DIFFERENT person
                    # (e.g., email recycled to new employee).
                    #
                    # We cannot create a new user because email is unique in the database.
                    # This requires admin intervention to resolve (e.g., delete/rename the
                    # old account, or update the old account's unique_id).
                    raise HTTPException(
                        status_code=403,
                        detail="Account conflict: this email is associated with a different "
                        "LDAP account. Contact your administrator.",
                    )
                else:
                    # Same unique_id (case-insensitive match) - normalize case in DB
                    if user.oauth2_user_id != unique_id:
                        user.oauth2_user_id = unique_id
    else:
        # Simple mode: lookup by email only (oauth2_user_id is NULL)
        user = await _lookup_by_email(session, email)

    # Step 2: Validate role exists
    role = await session.scalar(
        select(models.UserRole).where(models.UserRole.name == user_info.role)
    )
    if not role:
        raise HTTPException(
            status_code=500,
            detail="Role not found in database",
        )

    # Step 3: Update existing user attributes
    if user:
        # Sync email on every login (email may have changed in LDAP)
        if user.email != email:
            user.email = email

        # Note: Do NOT sync username - it should remain stable
        # Updating username could cause collisions if displayName changes in LDAP

        # Update role if it changed
        if user.role.name != role.name:
            user.role = role
        return user

    # Step 4: Create new user (if sign-up is allowed)
    if not ldap_config.allow_sign_up:
        raise HTTPException(
            status_code=401,
            detail="Invalid username and/or password",
        )

    # Security: Check if email already exists with different auth method
    existing_user = await session.scalar(
        select(models.User).where(func.lower(models.User.email) == email)
    )
    if existing_user and not is_ldap_user(existing_user.oauth2_client_id):
        logger.error(
            "Email already exists with different auth method: %s", existing_user.auth_method
        )
        raise HTTPException(
            status_code=401,
            detail="Invalid username and/or password",
        )

    # Username strategy: Try displayName first (user-friendly), handle collisions gracefully
    username = user_info.display_name
    existing_username = await session.scalar(
        select(models.User).where(models.User.username == username)
    )
    if existing_username:
        # Collision detected - append short suffix to make unique
        username = f"{user_info.display_name} ({secrets.token_hex(2)})"

    user = models.User(
        # Store sanitized email to avoid casing/whitespace mismatches on lookup
        email=email,
        username=username,
        role=role,
        reset_password=False,
        auth_method="OAUTH2",  # TODO: change to LDAP in future db migration
        oauth2_client_id=LDAP_CLIENT_ID_MARKER,
        oauth2_user_id=unique_id,  # None if unique_id not configured (use email column)
    )
    session.add(user)
    return user


async def _lookup_by_unique_id(session: AsyncSession, unique_id: str) -> Optional[models.User]:
    """Look up LDAP user by immutable unique ID (objectGUID, entryUUID, etc.).

    Uses case-insensitive comparison because:
    - UUIDs are case-insensitive per RFC 4122
    - Older versions may have stored uppercase UUIDs
    - Current code normalizes to lowercase

    This ensures users aren't locked out due to case differences.
    """
    return cast(
        Optional[models.User],
        await session.scalar(
            select(models.User)
            .where(models.User.oauth2_client_id == LDAP_CLIENT_ID_MARKER)
            .where(func.lower(models.User.oauth2_user_id) == unique_id.lower())
            .options(joinedload(models.User.role))
        ),
    )


async def _lookup_by_email(session: AsyncSession, email: str) -> Optional[models.User]:
    """Look up LDAP user by email (case-insensitive fallback)."""
    return cast(
        Optional[models.User],
        await session.scalar(
            select(models.User)
            .where(models.User.oauth2_client_id == LDAP_CLIENT_ID_MARKER)
            .where(func.lower(models.User.email) == email)
            .options(joinedload(models.User.role))
        ),
    )
