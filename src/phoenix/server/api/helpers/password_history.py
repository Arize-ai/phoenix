from __future__ import annotations

from typing import TYPE_CHECKING, Awaitable, Callable

from sqlalchemy import delete, select
from starlette.datastructures import Secret

from phoenix.config import get_env_password_history_size
from phoenix.db.models import PasswordHistory

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from phoenix.db.models import User


async def check_password_history(
    *,
    session: AsyncSession,
    user: User,
    new_password: Secret,
    hash_fn: Callable[[Secret, bytes], Awaitable[bytes]],
) -> None:
    """
    Checks whether the new password matches the user's current password or any
    of their recent historical passwords. Raises ValueError if it does.

    Args:
        session: The database session.
        user: The user whose password is being changed.
        new_password: The proposed new password.
        hash_fn: An async function that hashes a password with a given salt.
    """
    history_size = get_env_password_history_size()
    if history_size <= 0:
        return

    # Check against current password
    if user.password_hash and user.password_salt:
        current_hash = await hash_fn(new_password, user.password_salt)
        if current_hash == user.password_hash:
            raise ValueError("New password must be different from recent passwords")

    # Check against historical passwords
    stmt = (
        select(PasswordHistory)
        .where(PasswordHistory.user_id == user.id)
        .order_by(PasswordHistory.created_at.desc())
        .limit(history_size)
    )
    result = await session.scalars(stmt)
    for entry in result:
        historical_hash = await hash_fn(new_password, entry.password_salt)
        if historical_hash == entry.password_hash:
            raise ValueError("New password must be different from recent passwords")


async def save_to_password_history(
    *,
    session: AsyncSession,
    user: User,
) -> None:
    """
    Saves the user's current password hash and salt to the password history table,
    and prunes old entries beyond the configured history size.

    Args:
        session: The database session.
        user: The user whose current password should be saved to history.
    """
    history_size = get_env_password_history_size()
    if history_size <= 0:
        return

    if not user.password_hash or not user.password_salt:
        return

    session.add(
        PasswordHistory(
            user_id=user.id,
            password_hash=user.password_hash,
            password_salt=user.password_salt,
        )
    )
    await session.flush()

    # Prune old entries beyond the history size
    keep_ids_stmt = (
        select(PasswordHistory.id)
        .where(PasswordHistory.user_id == user.id)
        .order_by(PasswordHistory.created_at.desc())
        .limit(history_size)
    )
    keep_ids = (await session.scalars(keep_ids_stmt)).all()
    if keep_ids:
        await session.execute(
            delete(PasswordHistory).where(
                PasswordHistory.user_id == user.id,
                PasswordHistory.id.notin_(keep_ids),
            )
        )
