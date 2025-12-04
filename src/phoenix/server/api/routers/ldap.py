import logging
import secrets

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from phoenix.auth import sanitize_email
from phoenix.config import LDAPConfig
from phoenix.db import models
from phoenix.server.ldap import LDAP_CLIENT_ID_MARKER, LDAPUserInfo, canonicalize_dn, is_ldap_user

logger = logging.getLogger(__name__)


async def get_or_create_ldap_user(
    session: AsyncSession,
    user_info: LDAPUserInfo,
    ldap_config: LDAPConfig,
) -> models.User:
    """
    Retrieves an existing LDAP user or creates a new one.

    Implements the zero-migration strategy using LDAP_CLIENT_ID_MARKER.

    DN Case-Insensitivity:
        Per RFC 4514, DNs are case-insensitive. However, LDAP servers may return
        DNs with different casing (e.g., "uid=alice" vs "uid=Alice") across logins,
        especially in multi-DC Active Directory environments. To prevent lockouts:
        - DNs are normalized to lowercase before storage
        - Lookups use case-insensitive comparison (func.lower)
    """
    # Canonicalize DN per RFC 4514 (DNs are case-insensitive)
    # Handles: case, whitespace, multi-valued RDN ordering, hex encoding
    user_dn = user_info.user_dn
    user_dn_canonical = canonicalize_dn(user_dn)
    email = sanitize_email(user_info.email)

    # Look up LDAP user by DN (case-insensitive, stable identifier)
    user = await session.scalar(
        select(models.User)
        .where(models.User.oauth2_client_id == LDAP_CLIENT_ID_MARKER)
        .where(models.User.oauth2_user_id == user_dn_canonical)
        .options(joinedload(models.User.role))
    )

    # Fallback: If not found by DN, try email lookup (for admin-provisioned users)
    if not user:
        user = await session.scalar(
            select(models.User)
            .where(models.User.oauth2_client_id == LDAP_CLIENT_ID_MARKER)
            .where(models.User.oauth2_user_id.is_(None))
            .where(func.lower(models.User.email) == email)
            .options(joinedload(models.User.role))
        )
        # If found by email, upgrade to DN-based storage (canonical)
        if user:
            user.oauth2_user_id = user_dn_canonical

    role = await session.scalar(
        select(models.UserRole).where(models.UserRole.name == user_info.role)
    )
    if not role:
        raise HTTPException(
            status_code=500,
            detail="Role not found in database",
        )

    if user:
        # Sync LDAP attributes on every login
        if user.email != email:
            user.email = email
        # Note: Do NOT sync username - it should remain stable
        # Updating username could cause collisions if displayName changes in LDAP

        # Update role if it changed
        if user.role.name != role.name:
            user.role = role
        return user

    # Check if sign-up is allowed
    if not ldap_config.allow_sign_up:
        # User doesn't exist and auto-sign-up is disabled
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

    # Create new LDAP user (store normalized DN per RFC 4514)
    # Username strategy: Try displayName first (user-friendly), handle collisions gracefully
    # If displayName collides (multiple "John Smith"), append suffix for uniqueness
    username = user_info.display_name

    # Check if username already exists (potential collision)
    existing_username = await session.scalar(
        select(models.User).where(models.User.username == username)
    )

    if existing_username:
        # Collision detected - append short suffix to make unique
        username = f"{user_info.display_name} ({secrets.token_hex(2)})"
        # If this suffixed username also collides (extremely rare),
        # we'll get a DB constraint error.

    user = models.User(
        email=user_info.email,
        username=username,
        role=role,
        reset_password=False,
        auth_method="OAUTH2",  # TODO: change to LDAP in future db migration
        oauth2_client_id=LDAP_CLIENT_ID_MARKER,
        oauth2_user_id=user_dn_canonical,
    )
    session.add(user)
    return user
