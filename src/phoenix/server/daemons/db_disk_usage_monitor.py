from __future__ import annotations

import logging
from asyncio import sleep
from datetime import datetime, timedelta, timezone
from typing import Optional, cast

import sqlalchemy as sa
from email_validator import EmailNotValidError, validate_email
from sqlalchemy import text
from typing_extensions import assert_never

from phoenix.config import (
    get_env_database_allocated_storage_capacity_gibibytes,
    get_env_database_usage_email_warning_threshold_percentage,
    get_env_database_usage_insertion_blocking_threshold_percentage,
)
from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.email.types import DbUsageWarningEmailSender
from phoenix.server.types import DaemonTask, DbSessionFactory

logger = logging.getLogger(__name__)

_SLEEP_SECONDS = 1
_EMAIL_FREQUENCY_HOURS = 24
_BYTES_PER_GIBIBYTE = 1024**3


class DbDiskUsageMonitor(DaemonTask):
    """
    Monitors database disk space usage and triggers warnings/blocking when thresholds are exceeded.

    This daemon:
    - Periodically checks current database size
    - Compares usage against configured thresholds
    - Sends warning emails to admins when warning threshold is reached
    - Toggles insertion blocking when blocking threshold is reached
    """

    def __init__(
        self,
        db: DbSessionFactory,
        email_sender: Optional[DbUsageWarningEmailSender] = None,
    ) -> None:
        super().__init__()
        self._db = db
        self._email_sender = email_sender
        # Tracks last email send time per admin email address to prevent spam
        self._last_email_sent: dict[str, datetime] = {}

    @property
    def _is_disabled(self) -> bool:
        return not bool(
            get_env_database_allocated_storage_capacity_gibibytes()
            and (
                get_env_database_usage_email_warning_threshold_percentage()
                or get_env_database_usage_insertion_blocking_threshold_percentage()
            )
        )

    async def _run(self) -> None:
        if self._is_disabled:
            logger.debug("Database disk space monitoring is disabled")
            return

        logger.debug("Starting database disk space monitoring")
        while self._running:
            try:
                current_usage_gibibytes = await self._check_disk_space()
            except Exception:
                logger.exception("Failed to check disk space")
            else:
                logger.debug(f"Current database usage: {current_usage_gibibytes:,.1f} GiB")
                try:
                    await self._check_thresholds(current_usage_gibibytes)
                except Exception:
                    logger.exception("Failed to check database usage thresholds")
            await sleep(_SLEEP_SECONDS)

    async def _check_disk_space(self) -> float:
        if self._db.dialect is SupportedSQLDialect.SQLITE:
            async with self._db() as session:
                page_count = await session.scalar(text("PRAGMA page_count;"))
                freelist_count = await session.scalar(text("PRAGMA freelist_count;"))
                page_size = await session.scalar(text("PRAGMA page_size;"))
            current_usage_bytes = (page_count - freelist_count) * page_size
        elif self._db.dialect is SupportedSQLDialect.POSTGRESQL:
            async with self._db() as session:
                current_usage_bytes = await session.scalar(
                    text("SELECT pg_database_size(current_database());")
                )
        else:
            assert_never(self._db.dialect)
        return cast(float, current_usage_bytes / _BYTES_PER_GIBIBYTE)

    async def _check_thresholds(self, current_usage_gibibytes: float) -> None:
        allocated_capacity_gibibytes = get_env_database_allocated_storage_capacity_gibibytes()
        if not allocated_capacity_gibibytes:
            return

        used_percentage = (current_usage_gibibytes / allocated_capacity_gibibytes) * 100
        logger.debug(
            f"Database usage: {used_percentage:.1f}% "
            f"({current_usage_gibibytes:,.1f} / {allocated_capacity_gibibytes:,.1f} GiB)"
        )

        # Check insertion blocking threshold
        if (
            insertion_blocking_threshold_percentage
            := get_env_database_usage_insertion_blocking_threshold_percentage()
        ):
            should_not_insert_or_update = used_percentage >= insertion_blocking_threshold_percentage
            if should_not_insert_or_update:
                logger.info(
                    f"Database usage {used_percentage:.1f}% exceeds blocking threshold "
                    f"{insertion_blocking_threshold_percentage:.1f}%, enabling insertion blocking"
                )
            self._db.should_not_insert_or_update = should_not_insert_or_update

        # Check warning email threshold
        if (
            notification_threshold_percentage
            := get_env_database_usage_email_warning_threshold_percentage()
        ):
            if used_percentage >= notification_threshold_percentage:
                logger.debug(
                    f"Database usage {used_percentage:.2f}% exceeds warning threshold "
                    f"{notification_threshold_percentage}%, sending warning emails"
                )
                await self._send_warning_emails(
                    used_percentage,
                    allocated_capacity_gibibytes,
                    notification_threshold_percentage,
                )

    async def _send_warning_emails(
        self,
        used_percentage: float,
        allocated_capacity_gibibytes: float,
        notification_threshold_percentage: float,
    ) -> None:
        if not self._email_sender:
            logger.debug("Email sender is not configured, skipping database usage warning emails.")
            return

        current_usage_gibibytes = used_percentage / 100 * allocated_capacity_gibibytes
        stmt = (
            sa.select(models.User.email)
            .join(models.UserRole)
            .where(models.UserRole.name == "ADMIN")
        )

        try:
            async with self._db() as session:
                admin_emails = (await session.scalars(stmt)).all()
        except Exception:
            logger.exception(
                "Failed to fetch admin emails from database, "
                "skipping database usage warning emails"
            )
            return

        if not admin_emails:
            logger.debug(
                "No admin emails found in database, " "skipping database usage warning emails"
            )
            return

        # Validate email addresses
        valid_emails: list[str] = []

        for email in admin_emails:
            try:
                normalized_email = validate_email(email, check_deliverability=False).normalized
            except EmailNotValidError:
                pass
            else:
                valid_emails.append(normalized_email)

        if not valid_emails:
            logger.debug(
                f"No valid emails found for admins (found {len(admin_emails)} admins), "
                f"skipping database usage warning emails"
            )
            return

        self._last_email_sent = {
            email: timestamp
            for email, timestamp in self._last_email_sent.items()
            if email in valid_emails
        }

        now = datetime.now(timezone.utc)
        emails_sent = 0
        send_attempts = 0

        for email in valid_emails:
            if email in self._last_email_sent and now - self._last_email_sent[email] < timedelta(
                hours=_EMAIL_FREQUENCY_HOURS
            ):
                continue
            send_attempts += 1
            try:
                await self._email_sender.send_db_usage_warning_email(
                    email=email,
                    current_usage_gibibytes=current_usage_gibibytes,
                    allocated_storage_gibibytes=allocated_capacity_gibibytes,
                    notification_threshold_percentage=notification_threshold_percentage,
                )
            except Exception:
                logger.exception(f"Failed to send database usage warning email to {email}")
            else:
                self._last_email_sent[email] = now
                emails_sent += 1

        logger.debug(f"Database usage warning emails: {emails_sent}/{send_attempts} sent")
