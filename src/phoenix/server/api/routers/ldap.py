import logging
import secrets
from typing import cast

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from phoenix.auth import sanitize_email
from phoenix.config import LDAPConfig
from phoenix.db import models
from phoenix.server.ldap import LDAPUserInfo

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
           - Stores the immutable LDAP unique ID in ldap_unique_id
           - Primary lookup by ldap_unique_id, fallback by email
           - Survives: DN changes, email changes, renames, OU moves, domain consolidation
           - This is how enterprise IAM systems (Okta, Azure AD Connect) work

        2. Otherwise (default):
           - ldap_unique_id is NULL (no redundant email storage)
           - Lookup by email column directly
           - Survives: DN changes, OU moves, renames
           - Simple setup for most organizations

    Null Email Mode:
        When PHOENIX_LDAP_ATTR_EMAIL is "null", the LDAP directory doesn't have
        email attributes. In this mode:
        - unique_id is required (enforced at config validation)
        - Lookup is by unique_id only (no email fallback)
        - email is stored as NULL in the database

    Admin-Provisioned Users:
        Admins can pre-create users with ldap_unique_id=NULL. On first login,
        the user is matched by email and ldap_unique_id is populated (if unique_id
        is configured). Not supported in null email mode.
    """
    unique_id = user_info.unique_id  # Required when email is None

    # Determine the email to use for lookup and storage
    # If user_info.email is None, we're in null email mode
    email: str | None = sanitize_email(user_info.email) if user_info.email else None

    # Step 1: Look up user
    # Strategy depends on whether unique_id is configured
    user: models.User | None = None

    if unique_id:
        # Enterprise mode (or null email mode): lookup by unique_id first
        user = await _lookup_by_unique_id(session, unique_id)

        # Fallback: email lookup (handles migration to unique_id)
        # Skip this in null email mode (no real email to look up)
        if not user and email:
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
                if user.ldap_unique_id is None:
                    user.ldap_unique_id = unique_id
                elif user.ldap_unique_id.lower() != unique_id.lower():
                    # Email matches but unique_id differs - this is a DIFFERENT person
                    # (e.g., email recycled to new employee).
                    #
                    # We cannot create a new user because email is unique in the database.
                    # This requires admin intervention to resolve (e.g., delete/rename the
                    # old account, or update the old account's unique_id).
                    logger.error(
                        f"LDAP account conflict: user_id={user.id} has different unique_id. "
                        f"Admin must resolve (delete old account or update unique_id)."
                    )
                    raise HTTPException(
                        status_code=401,
                        detail="Invalid username and/or password",
                    )
                else:
                    # Same unique_id (case-insensitive match) - normalize case in DB
                    if user.ldap_unique_id != unique_id:
                        user.ldap_unique_id = unique_id
    elif email:
        # Simple mode: lookup by email only (ldap_unique_id is NULL)
        user = await _lookup_by_email(session, email)
    # else: neither unique_id nor email - this shouldn't happen (config validation prevents it)

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
        if email and user.email != email:
            user.email = email

        # Note: Do NOT sync username - it should remain stable
        # Updating username could cause collisions if displayName changes in LDAP

        # Update role if it changed
        if user.role.name != role.name:
            user.role = role
        return user

    # Step 4: Create new user (if sign-up is allowed)
    if not ldap_config.allow_sign_up:
        logger.info("LDAP user attempted to sign up but sign-up is not allowed")
        raise HTTPException(
            status_code=401,
            detail="Invalid username and/or password",
        )

    # Determine the email to store in the database
    if email:
        db_email = email
        # Security: Check if email already exists with different auth method
        existing_user = await session.scalar(
            select(models.User).where(func.lower(models.User.email) == email.lower())
        )
        if existing_user and existing_user.auth_method != "LDAP":
            logger.error(
                "Email already exists with different auth method: %s", existing_user.auth_method
            )
            raise HTTPException(
                status_code=401,
                detail="Invalid username and/or password",
            )
    else:
        # Null email mode: email column is nullable, so just use None
        # CRITICAL: unique_id is required when email is None. Without it, we'd create
        # orphan users (both email=NULL and ldap_unique_id=NULL) that can never be
        # found on subsequent logins - neither lookup path would match.
        if unique_id is None:
            raise ValueError("unique_id required when email is None")
        db_email = None

    # Username strategy: Try displayName first (user-friendly), handle collisions gracefully
    username = user_info.display_name
    existing_username = await session.scalar(
        select(models.User).where(models.User.username == username)
    )
    if existing_username:
        # Collision detected - append short suffix to make unique
        username = f"{user_info.display_name} ({secrets.token_hex(3)})"

    user = models.LDAPUser(
        email=db_email,
        username=username,
        ldap_unique_id=unique_id,  # None if unique_id not configured (email-based lookup)
        user_role_id=role.id,
    )
    user.role = role  # Set relationship for eager access after session closes
    session.add(user)
    return user


async def _lookup_by_unique_id(session: AsyncSession, unique_id: str) -> models.User | None:
    """Look up LDAP user by immutable unique ID (objectGUID, entryUUID, etc.).

    Uses case-insensitive comparison because:
    - UUIDs are case-insensitive per RFC 4122
    - Older versions may have stored uppercase UUIDs
    - Current code normalizes to lowercase

    This ensures users aren't locked out due to case differences.
    """
    return cast(
        models.User | None,
        await session.scalar(
            select(models.User)
            .where(models.User.auth_method == "LDAP")
            .where(func.lower(models.User.ldap_unique_id) == unique_id.lower())
            .options(joinedload(models.User.role))
        ),
    )


async def _lookup_by_email(session: AsyncSession, email: str) -> models.User | None:
    """Look up LDAP user by email (case-insensitive).

    Note: Both sides of the comparison are lowercased to ensure consistent
    matching regardless of what sanitize_email() does to the input.
    """
    return cast(
        models.User | None,
        await session.scalar(
            select(models.User)
            .where(models.User.auth_method == "LDAP")
            .where(func.lower(models.User.email) == email.lower())
            .options(joinedload(models.User.role))
        ),
    )
