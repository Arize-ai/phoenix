from __future__ import annotations

import logging
from asyncio import sleep
from datetime import datetime, timedelta, timezone
from typing import Optional

import sqlalchemy as sa
from email_validator import EmailNotValidError, validate_email
from sqlalchemy import text
from typing_extensions import assert_never

from phoenix.config import (
    ENV_PHOENIX_SQL_DATABASE_SCHEMA,
    get_env_database_allocated_storage_capacity_gibibytes,
    get_env_database_usage_email_warning_threshold_percentage,
    get_env_database_usage_insertion_blocking_threshold_percentage,
    getenv,
)
from phoenix.db import models
from phoenix.db.helpers import SupportedSQLDialect
from phoenix.server.email.types import DbUsageWarningEmailSender
from phoenix.server.prometheus import (
    DB_DISK_USAGE_BYTES,
    DB_DISK_USAGE_RATIO,
    DB_DISK_USAGE_WARNING_EMAIL_ERRORS,
    DB_DISK_USAGE_WARNING_EMAILS_SENT,
    DB_INSERTIONS_BLOCKED,
)
from phoenix.server.types import DaemonTask, DbSessionFactory

logger = logging.getLogger(__name__)

_SLEEP_SECONDS = 60
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
            return

        while self._running:
            try:
                current_usage_bytes = await self._check_disk_usage_bytes()
            except Exception:
                logger.exception("Failed to check disk space")
            else:
                DB_DISK_USAGE_BYTES.set(current_usage_bytes)
                current_usage_gibibytes = current_usage_bytes / _BYTES_PER_GIBIBYTE
                try:
                    await self._check_thresholds(current_usage_gibibytes)
                except Exception:
                    logger.exception("Failed to check database usage thresholds")
            await sleep(_SLEEP_SECONDS)

    async def _check_disk_usage_bytes(self) -> float:
        if self._db.dialect is SupportedSQLDialect.SQLITE:
            async with self._db() as session:
                page_count = await session.scalar(text("PRAGMA page_count;"))
                freelist_count = await session.scalar(text("PRAGMA freelist_count;"))
                page_size = await session.scalar(text("PRAGMA page_size;"))
            current_usage_bytes = (page_count - freelist_count) * page_size
        elif self._db.dialect is SupportedSQLDialect.POSTGRESQL:
            nspname = getenv(ENV_PHOENIX_SQL_DATABASE_SCHEMA) or "public"
            stmt = text("""\
                SELECT sum(pg_total_relation_size(c.oid))
                FROM pg_class as c
                INNER JOIN pg_namespace as n ON n.oid = c.relnamespace
                WHERE c.relkind = 'r'
                AND n.nspname = :nspname;
            """).bindparams(nspname=nspname)
            async with self._db() as session:
                current_usage_bytes = await session.scalar(stmt)
        else:
            assert_never(self._db.dialect)
        return float(current_usage_bytes)

    async def _check_thresholds(self, current_usage_gibibytes: float) -> None:
        allocated_capacity_gibibytes = get_env_database_allocated_storage_capacity_gibibytes()
        if not allocated_capacity_gibibytes:
            return

        used_ratio = current_usage_gibibytes / allocated_capacity_gibibytes
        DB_DISK_USAGE_RATIO.set(used_ratio)
        used_percentage = used_ratio * 100

        # Check insertion blocking threshold
        if (
            insertion_blocking_threshold_percentage
            := get_env_database_usage_insertion_blocking_threshold_percentage()
        ):
            should_not_insert_or_update = used_percentage > insertion_blocking_threshold_percentage
            self._db.should_not_insert_or_update = should_not_insert_or_update
            DB_INSERTIONS_BLOCKED.set(int(should_not_insert_or_update))

        # Check warning email threshold
        if (
            notification_threshold_percentage
            := get_env_database_usage_email_warning_threshold_percentage()
        ):
            if used_percentage > notification_threshold_percentage:
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
                # Count email send errors
                DB_DISK_USAGE_WARNING_EMAIL_ERRORS.inc()
            else:
                self._last_email_sent[email] = now
                emails_sent += 1
                # Count successful warning email sends
                DB_DISK_USAGE_WARNING_EMAILS_SENT.inc()
